import { format, isWithinInterval, parseISO, subMonths } from "date-fns";
import { getCycleWindow } from "@/lib/domain/cycle";
import { mainSpendBuckets } from "@/lib/domain/categories";
import { getWeekLabel, getWeekRange, getWeekStatus, getWeeklyHistory, getWeeklyTotals, WEEKLY_TARGET } from "@/lib/domain/weekly";
import type {
  Account,
  AccountSummary,
  Budget,
  BudgetSummary,
  MerchantTrend,
  Transaction,
  TrendPoint,
  WeeklyMode,
  WeeklyTrackerSummary,
} from "@/lib/domain/types";

const REVIEW_DUPLICATE_WINDOW_DAYS = 7;
const REVIEW_DUPLICATE_LOOKBACK_DAYS = 10;

export function filterTransactionsForCycle(transactions: Transaction[], cycleStartDay = 22, now = new Date()) {
  const cycle = getCycleWindow(now, cycleStartDay);

  return transactions.filter(
    (transaction) =>
      countsTowardSpend(transaction) &&
      isWithinInterval(parseISO(transaction.date), {
        start: cycle.start,
        end: cycle.end,
      }),
  );
}

export function buildBudgetSummary(
  transactions: Transaction[],
  budget: Budget,
  cycleStartDay = 22,
  now = new Date(),
): BudgetSummary {
  const currentCycleTransactions = filterTransactionsForCycle(transactions, cycleStartDay, now);
  const totalSpend = sumByCategory(currentCycleTransactions, ["fixed_cc", "groceries", "essential_variable", "lifestyle", "one_off", "bills"]);
  const lifestyleSpend = sumByCategory(currentCycleTransactions, ["lifestyle"]);
  const fixedSpend = sumByCategory(currentCycleTransactions, ["fixed_cc"]);
  const groceriesSpend = sumByCategory(currentCycleTransactions, ["groceries"]);
  const essentialVariableSpend = sumByCategory(currentCycleTransactions, ["essential_variable"]);
  const oneOffSpend = sumByCategory(currentCycleTransactions, ["one_off"]);
  const mortgageSpend = sumByCategory(currentCycleTransactions, ["mortgage", "mortgage_extra"]);
  const transferExcludedSpend = currentCycleTransactions
    .filter((transaction) => transaction.finalCategory !== "transfer")
    .reduce((sum, transaction) => sum + debitAmount(transaction), 0);
  const reimbursementExcludedSpend = currentCycleTransactions
    .filter((transaction) => !transaction.isReimbursement)
    .reduce((sum, transaction) => sum + debitAmount(transaction), 0);
  const operatingSpend = currentCycleTransactions
    .filter((transaction) => !["transfer", "rebate", "childcare_rebate", "income"].includes(transaction.finalCategory))
    .reduce((sum, transaction) => sum + debitAmount(transaction), 0);
  const budgetTrackedSpend = currentCycleTransactions
    .filter(
      (transaction) =>
        ![
          "transfer",
          "rebate",
          "childcare_rebate",
          "income",
          "mortgage",
          "mortgage_extra",
        ].includes(transaction.finalCategory),
    )
    .reduce((sum, transaction) => sum + debitAmount(transaction), 0);

  return {
    totalSpend,
    lifestyleSpend,
    fixedSpend,
    groceriesSpend,
    essentialVariableSpend,
    oneOffSpend,
    mortgageSpend,
    operatingSpend,
    budgetTrackedSpend,
    transferExcludedSpend,
    reimbursementExcludedSpend,
    remainingBudget: budget.cycleTarget - budgetTrackedSpend,
    paceStatus:
      budgetTrackedSpend >
      budget.cycleTarget * getCycleWindow(now, cycleStartDay).progress
        ? "over_pace"
        : "on_track",
    uncategorizedCount: currentCycleTransactions.filter((transaction) => transaction.needsReview).length,
  };
}

export function buildTrendSeries(
  transactions: Transaction[],
  mode: "calendar" | "cycle" = "cycle",
  cycleStartDay = 22,
) {
  const labels = Array.from({ length: 6 }, (_, index) => subMonths(new Date(), 5 - index));

  return labels.map((date): TrendPoint => {
    const inWindow = transactions.filter((transaction) => {
      const txDate = parseISO(transaction.date);

      if (mode === "calendar") {
        return format(txDate, "yyyy-MM") === format(date, "yyyy-MM");
      }

      return transaction.cycleLabel === getCycleWindow(date, cycleStartDay).label;
    });

    const point = {
      label: mode === "calendar" ? format(date, "MMM") : getCycleWindow(date, cycleStartDay).label,
      fixed_cc: sumByCategory(inWindow, ["fixed_cc"]),
      groceries: sumByCategory(inWindow, ["groceries"]),
      essential_variable: sumByCategory(inWindow, ["essential_variable"]),
      lifestyle: sumByCategory(inWindow, ["lifestyle"]),
      one_off: sumByCategory(inWindow, ["one_off"]),
      total: 0,
    };

    point.total =
      point.fixed_cc + point.groceries + point.essential_variable + point.lifestyle + point.one_off;

    return point;
  });
}

export function buildMerchantTrends(transactions: Transaction[], cycleStartDay = 22): MerchantTrend[] {
  const currentLabel = getCycleWindow(new Date(), cycleStartDay).label;
  const previousLabel = getCycleWindow(subMonths(new Date(), 1), cycleStartDay).label;
  const totals = new Map<string, { current: number; previous: number }>();

  for (const transaction of transactions) {
    if (!mainSpendBuckets.includes(transaction.finalCategory as (typeof mainSpendBuckets)[number])) {
      continue;
    }

    const current = totals.get(transaction.merchantNormalized) ?? { current: 0, previous: 0 };

    if (transaction.cycleLabel === currentLabel) {
      current.current += debitAmount(transaction);
    }

    if (transaction.cycleLabel === previousLabel) {
      current.previous += debitAmount(transaction);
    }

    totals.set(transaction.merchantNormalized, current);
  }

  return [...totals.entries()]
    .map(([merchant, amounts]) => {
      const delta = amounts.current - amounts.previous;
      return {
        merchant,
        current: amounts.current,
        previous: amounts.previous,
        delta,
        deltaDirection: delta === 0 ? "flat" : delta > 0 ? "up" : "down",
      } satisfies MerchantTrend;
    })
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 8);
}

export function buildAccountSummaries(
  accounts: Account[],
  transactions: Transaction[],
  cycleStartDay = 22,
  now = new Date(),
): AccountSummary[] {
  const cycleTransactions = filterTransactionsForCycle(transactions, cycleStartDay, now);

  return accounts
    .map((account) => {
      const accountTransactions = transactions.filter((transaction) => transaction.accountId === account.id);
      const accountCycleTransactions = cycleTransactions.filter((transaction) => transaction.accountId === account.id);
      const lastTransaction = accountTransactions[0] ?? null;

      return {
        accountId: account.id,
        accountName: account.sourceAccountName,
        institutionName: account.institutionName,
        accountType: account.sourceAccountType,
        balance: account.balance,
        transactionCount: accountTransactions.length,
        cycleSpend: accountCycleTransactions.reduce((sum, transaction) => sum + debitAmount(transaction), 0),
        lastTransactionDate: lastTransaction?.date ?? null,
        reviewCount: accountTransactions.filter((transaction) => transaction.needsReview).length,
      } satisfies AccountSummary;
    })
    .sort((left, right) => right.transactionCount - left.transactionCount);
}

export function groupTransactionsByAccount(accounts: Account[], transactions: Transaction[]) {
  return accounts.map((account) => ({
    account,
    transactions: transactions.filter((transaction) => transaction.accountId === account.id),
  }));
}

export function buildReviewDuplicateMatches(
  transactions: Transaction[],
  windowDays = REVIEW_DUPLICATE_WINDOW_DAYS,
) {
  const duplicateMatchByTransactionId = new Map<string, string>();
  const groupedTransactions = new Map<string, Transaction[]>();
  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - REVIEW_DUPLICATE_LOOKBACK_DAYS);

  const eligibleTransactions = transactions
    .filter(
      (transaction) =>
        transaction.provider === "csv" &&
        transaction.pendingStatus !== "ignored_duplicate" &&
        parseISO(transaction.date) >= lookbackStart,
    )
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt.localeCompare(right.createdAt);
      }

      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }

      return left.id.localeCompare(right.id);
    });

  for (const transaction of eligibleTransactions) {
    const key = [
      transaction.provider,
      transaction.sourceAccountName.trim().toLowerCase(),
      transaction.merchantNormalized.trim().toLowerCase(),
      transaction.direction,
      transaction.amount.toFixed(2),
    ].join("|");

    const candidates = groupedTransactions.get(key) ?? [];
    const matchedCandidate = [...candidates]
      .reverse()
      .find((candidate) => Math.abs(diffTransactionDays(candidate.date, transaction.date)) <= windowDays);

    if (matchedCandidate) {
      duplicateMatchByTransactionId.set(transaction.id, matchedCandidate.id);
    }

    candidates.push(transaction);
    groupedTransactions.set(key, candidates);
  }

  return duplicateMatchByTransactionId;
}

export function buildWeeklyTrackerSummary(
  transactions: Transaction[],
  mode: WeeklyMode = "calendar",
  cycleStartDay = 22,
  now = new Date(),
): WeeklyTrackerSummary {
  const { start, end } = getWeekRange(now, mode, cycleStartDay);
  const currentTotals = getWeeklyTotals(transactions, start, end);
  const previousRange = getWeekRange(new Date(start.getTime() - 86_400_000), mode, cycleStartDay);
  const previousTotals = getWeeklyTotals(transactions, previousRange.start, previousRange.end);
  const history = getWeeklyHistory(transactions, mode, cycleStartDay, now, 8);
  const recentAverageControlSpend =
    history.slice(0, -1).reduce((sum, point) => sum + point.controlSpend, 0) / Math.max(history.length - 1, 1);
  const averageWeeklyGroceries = history.reduce((sum, point) => sum + point.groceries, 0) / Math.max(history.length, 1);
  const averageWeeklyLifestyle = history.reduce((sum, point) => sum + point.lifestyle, 0) / Math.max(history.length, 1);
  const highestLifestyleWeek = [...history].sort((left, right) => right.lifestyle - left.lifestyle)[0] ?? null;
  const previousWeekDelta = currentTotals.controlSpend - previousTotals.controlSpend;

  return {
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    label: getWeekLabel(now, mode, cycleStartDay),
    mode,
    groceries: currentTotals.groceries,
    lifestyle: currentTotals.lifestyle,
    essentialVariable: currentTotals.essentialVariable,
    fixedCC: currentTotals.fixedCC,
    totalSpend: currentTotals.totalSpend,
    controlSpend: currentTotals.controlSpend,
    target: WEEKLY_TARGET,
    remaining: WEEKLY_TARGET - currentTotals.controlSpend,
    status: getWeekStatus(currentTotals.controlSpend),
    previousWeekControlSpend: previousTotals.controlSpend,
    previousWeekDelta,
    previousWeekDeltaPercent:
      previousTotals.controlSpend === 0 ? null : previousWeekDelta / previousTotals.controlSpend,
    recentAverageControlSpend,
    averageWeeklyGroceries,
    averageWeeklyLifestyle,
    highestLifestyleWeek,
    vsAverageDirection:
      currentTotals.controlSpend === recentAverageControlSpend
        ? "flat"
        : currentTotals.controlSpend > recentAverageControlSpend
          ? "above"
          : "below",
    recentTransactions: currentTotals.transactions
      .filter((transaction) => ["groceries", "lifestyle", "essential_variable", "fixed_cc"].includes(transaction.finalCategory))
      .slice(0, 10),
    history,
  };
}

export function sumByCategory(transactions: Transaction[], categories: string[]) {
  return transactions
    .filter((transaction) => categories.includes(transaction.finalCategory))
    .reduce((sum, transaction) => sum + debitAmount(transaction), 0);
}

function debitAmount(transaction: Transaction) {
  return countsTowardSpend(transaction) && transaction.direction === "debit" ? Math.abs(transaction.amount) : 0;
}

function countsTowardSpend(transaction: Transaction) {
  return !["matched", "ignored_duplicate"].includes(transaction.pendingStatus);
}

function diffTransactionDays(left: string, right: string) {
  const leftTime = parseISO(left).getTime();
  const rightTime = parseISO(right).getTime();
  return Math.round((leftTime - rightTime) / 86_400_000);
}
