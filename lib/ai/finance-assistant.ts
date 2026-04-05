import { buildBudgetSummary, buildMerchantTrends, buildTrendSeries, filterTransactionsForCycle } from "@/lib/domain/selectors";
import { categories } from "@/lib/domain/categories";
import { formatCurrency } from "@/lib/domain/format";
import { generateJson } from "@/lib/ai/openai";
import type { AiInsight, AiSuggestion, AppSnapshot, CategoryKind, Transaction } from "@/lib/domain/types";

const suggestionCategories = categories.map((category) => ({
  slug: category.slug,
  label: category.label,
  group: category.group,
}));

export async function getAiSuggestions(snapshot: AppSnapshot, transactions: Transaction[]) {
  if (transactions.length === 0) {
    return [] satisfies AiSuggestion[];
  }

  try {
    const response = await generateJson<{ suggestions: AiSuggestion[] }>({
      system:
        "You are a careful household spend categorisation assistant. Follow the provided category definitions. Never invent categories. Return compact JSON only.",
      prompt: JSON.stringify({
        instruction:
          "Suggest the best category for each transaction. Manual overrides always win, but these items still need review. Use conservative confidence. Mark shouldAutoApply true only if confidence >= 0.9 and the merchant pattern is stable. Categories are not accounting categories; they are practical household buckets.",
        categories: suggestionCategories,
        knownRules: snapshot.merchantRules.slice(0, 80).map((rule) => ({
          merchant: rule.normalizedMerchant,
          category: rule.category,
          splitMerchant: rule.splitMerchant,
        })),
        transactions: transactions.map((transaction) => ({
          transactionId: transaction.id,
          merchantRaw: transaction.merchantRaw,
          merchantNormalized: transaction.merchantNormalized,
          descriptionRaw: transaction.descriptionRaw,
          amount: transaction.amount,
          direction: transaction.direction,
          sourceAccountType: transaction.sourceAccountType,
          previousAutoCategory: transaction.autoCategory,
          existingFinalCategory: transaction.finalCategory,
        })),
      }),
    });

    if (!response?.suggestions?.length) {
      return getFallbackSuggestions(transactions);
    }

    return response.suggestions.map((suggestion) => ({
      ...suggestion,
      confidence: clampConfidence(suggestion.confidence),
      shouldAutoApply: Boolean(suggestion.shouldAutoApply) && clampConfidence(suggestion.confidence) >= 0.9,
    }));
  } catch {
    return getFallbackSuggestions(transactions);
  }
}

export async function getDashboardInsights(snapshot: AppSnapshot) {
  const budgetSummary = buildBudgetSummary(
    snapshot.transactions,
    snapshot.budget,
    snapshot.household.cycleStartDay,
  );
  const merchantTrends = buildMerchantTrends(snapshot.transactions, snapshot.household.cycleStartDay);
  const cycleTransactions = filterTransactionsForCycle(
    snapshot.transactions,
    snapshot.household.cycleStartDay,
  );
  const lifestyleTransactions = cycleTransactions
    .filter((transaction) => transaction.finalCategory === "lifestyle")
    .slice(0, 8)
    .map((transaction) => ({
      merchant: transaction.merchantNormalized,
      amount: transaction.amount,
    }));
  const trends = buildTrendSeries(snapshot.transactions, "cycle", snapshot.household.cycleStartDay).slice(-3);

  try {
    const response = await generateJson<{ insights: AiInsight[] }>({
      system:
        "You are a practical household budgeting analyst. Keep insights short, useful, and plain-English. Focus on weekly action, not accounting jargon. Return JSON only.",
      prompt: JSON.stringify({
        instruction:
          "Write 3 concise household budget insights. Prioritize lifestyle control, cycle pace, biggest merchant movements, and what to watch next. Each insight needs a title, body, and tone.",
        cycleBudget: {
          totalTarget: snapshot.budget.cycleTarget,
          lifestyleTarget: snapshot.budget.lifestyleTarget,
        },
        summary: budgetSummary,
        recentLifestyleTransactions: lifestyleTransactions,
        merchantTrends,
        recentTrendSeries: trends,
      }),
    });

    if (!response?.insights?.length) {
      return getFallbackInsights(snapshot);
    }

    return response.insights.slice(0, 3);
  } catch {
    return getFallbackInsights(snapshot);
  }
}

function getFallbackSuggestions(transactions: Transaction[]): AiSuggestion[] {
  return transactions.map((transaction) => {
    const merchant = `${transaction.merchantRaw} ${transaction.descriptionRaw}`;
    let suggestedCategory: CategoryKind = "uncategorized";
    let reason = "Not enough signal for a confident category, so keep this in review.";
    let confidence = 0.42;

    if (/amazon|apple/i.test(merchant)) {
      suggestedCategory = "review";
      reason = "This merchant often mixes subscriptions and discretionary purchases, so split review is safest.";
      confidence = 0.84;
    } else if (/uber eats|restaurant|cafe|square|kmart|uber/i.test(merchant)) {
      suggestedCategory = "lifestyle";
      reason = "This looks like discretionary day-to-day spending rather than a fixed or essential cost.";
      confidence = 0.79;
    } else if (/woolworths|coles|aldi|iga|bakers delight/i.test(merchant)) {
      suggestedCategory = "groceries";
      reason = "Merchant pattern matches regular food-for-home spending.";
      confidence = 0.92;
    } else if (/chemist|amcal|7-eleven/i.test(merchant)) {
      suggestedCategory = "essential_variable";
      reason = "This merchant usually falls into baseline fuel or pharmacy spending.";
      confidence = 0.88;
    } else if (transaction.direction === "debit" && transaction.amount > 600) {
      suggestedCategory = "one_off";
      reason = "The amount is unusually large for run-rate spending and likely belongs in One-Off.";
      confidence = 0.7;
    }

    return {
      transactionId: transaction.id,
      suggestedCategory,
      confidence,
      reason,
      shouldAutoApply: confidence >= 0.9,
    };
  });
}

function getFallbackInsights(snapshot: AppSnapshot): AiInsight[] {
  const summary = buildBudgetSummary(snapshot.transactions, snapshot.budget, snapshot.household.cycleStartDay);
  const merchantTrends = buildMerchantTrends(snapshot.transactions, snapshot.household.cycleStartDay);
  const topMerchant = merchantTrends[0];

  return [
    {
      title: summary.paceStatus === "over_pace" ? "Cycle pace is running hot" : "Cycle pace looks manageable",
      body:
        summary.paceStatus === "over_pace"
          ? `Spend excluding transfers is ${formatCurrency(summary.transferExcludedSpend)}, which is ahead of the current cycle pace. Lifestyle is the first lever to tighten this week.`
          : `Spend excluding transfers is ${formatCurrency(summary.transferExcludedSpend)} and is broadly tracking to target. Keeping lifestyle steady should protect the rest of the cycle.`,
      tone: summary.paceStatus === "over_pace" ? "warning" : "positive",
    },
    {
      title: "Lifestyle is the key watch item",
      body: `Lifestyle has used ${formatCurrency(summary.lifestyleSpend)} so far this cycle. That is the most practical bucket to review weekly because it changes fastest.`,
      tone: summary.lifestyleSpend > snapshot.budget.lifestyleTarget * 0.8 ? "warning" : "neutral",
    },
    {
      title: topMerchant ? `${topMerchant.merchant} moved the most` : "Merchant movement is still light",
      body: topMerchant
        ? `${topMerchant.merchant} changed by ${formatCurrency(topMerchant.delta)} versus the previous cycle, making it the clearest merchant-level swing to review.`
        : "Once more transaction history lands, merchant trend analysis will get more useful.",
      tone: topMerchant && topMerchant.delta > 0 ? "warning" : "neutral",
    },
  ];
}

function clampConfidence(value: number) {
  if (Number.isNaN(value)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, value));
}
