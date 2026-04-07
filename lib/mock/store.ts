import { createDemoSnapshot, seededMerchantRules } from "@/lib/mock/data";
import { getCycleLabelFromDate } from "@/lib/domain/cycle";
import { resolveTransactionCategory } from "@/lib/domain/categorization";
import { normalizeMerchant } from "@/lib/domain/merchant-normalization";
import { CSV_IMPORT_OVERLAP_DAYS, filterRowsForIncrementalImport, type ParsedImportRow } from "@/lib/csv/shared";
import type { AiSuggestion, AppSnapshot, CategoryKind, MerchantRule, Transaction } from "@/lib/domain/types";

declare global {
  var __demoSnapshot: AppSnapshot | undefined;
}

function getState() {
  globalThis.__demoSnapshot ??= createDemoSnapshot();
  return globalThis.__demoSnapshot;
}

export function getDemoSnapshot() {
  return structuredClone(getState());
}

export function resetDemoSnapshot() {
  globalThis.__demoSnapshot = createDemoSnapshot();
  return getDemoSnapshot();
}

export function updateTransactionCategory(transactionId: string, category: CategoryKind, notes?: string) {
  const state = getState();
  const transaction = state.transactions.find((entry) => entry.id === transactionId);

  if (!transaction) {
    return null;
  }

  transaction.overrideCategory = category;
  transaction.finalCategory = category;
  transaction.needsReview = false;
  transaction.reviewStatus = "reviewed";
  transaction.notes = notes ?? transaction.notes;
  transaction.aiSuggestedCategory = category;
  transaction.aiConfidence = 1;
  transaction.aiReason = "Accepted manually.";
  transaction.updatedAt = new Date().toISOString();

  return structuredClone(transaction);
}

export function addMerchantRule(input: Pick<MerchantRule, "merchantPattern" | "category"> & { splitMerchant?: boolean }) {
  const state = getState();
  const merchantRule: MerchantRule = {
    id: `rule_${state.merchantRules.length + seededMerchantRules.length + 1}`,
    householdId: state.household.id,
    merchantPattern: input.merchantPattern,
    normalizedMerchant: normalizeMerchant(input.merchantPattern),
    category: input.category,
    matchType: "exact",
    priority: state.merchantRules.length + 1,
    splitMerchant: input.splitMerchant ?? input.category === "review",
    active: true,
  };

  state.merchantRules.unshift(merchantRule);
  return structuredClone(merchantRule);
}

export function editMerchantRule(
  ruleId: string,
  input: Partial<Pick<MerchantRule, "merchantPattern" | "category" | "splitMerchant" | "active">>,
) {
  const state = getState();
  const rule = state.merchantRules.find((entry) => entry.id === ruleId);

  if (!rule) {
    return null;
  }

  if (typeof input.merchantPattern === "string" && input.merchantPattern.trim()) {
    rule.merchantPattern = input.merchantPattern.trim();
    rule.normalizedMerchant = normalizeMerchant(input.merchantPattern.trim());
  }

  if (input.category) {
    rule.category = input.category;
  }

  if (typeof input.splitMerchant === "boolean") {
    rule.splitMerchant = input.splitMerchant;
  }

  if (typeof input.active === "boolean") {
    rule.active = input.active;
  }

  return structuredClone(rule);
}

export function removeMerchantRule(ruleId: string) {
  const state = getState();
  const index = state.merchantRules.findIndex((entry) => entry.id === ruleId);

  if (index === -1) {
    return false;
  }

  state.merchantRules.splice(index, 1);
  return true;
}

export function reapplyMerchantRulesToTransactions() {
  const state = getState();

  state.transactions = state.transactions.map((transaction) => {
    const resolved = resolveTransactionCategory({
      merchantRaw: transaction.merchantRaw,
      descriptionRaw: transaction.descriptionRaw,
      overrideCategory: transaction.overrideCategory,
      amount: transaction.amount,
      direction: transaction.direction,
      merchantNormalized: transaction.merchantNormalized,
      rules: state.merchantRules,
    });

    return {
      ...transaction,
      merchantNormalized: resolved.merchantNormalized,
      autoCategory: resolved.autoCategory,
      finalCategory: resolved.finalCategory,
      reviewStatus: resolved.needsReview ? "needs_review" : transaction.overrideCategory ? "reviewed" : "auto_categorized",
      needsReview: resolved.needsReview,
      updatedAt: new Date().toISOString(),
    };
  });

  return getDemoSnapshot();
}

export function importTransactions(transactions: Array<Partial<Transaction>>) {
  const state = getState();

  const normalized = transactions.map((transaction, index) => {
    const merchantRaw = transaction.merchantRaw ?? transaction.descriptionRaw ?? "CSV Import";
    const date = transaction.date ?? new Date().toISOString();
    const direction = transaction.direction ?? "debit";
    const amount = Number(transaction.amount ?? 0);
    const resolved = resolveTransactionCategory({
      merchantRaw,
      descriptionRaw: transaction.descriptionRaw ?? merchantRaw,
      overrideCategory: transaction.overrideCategory ?? null,
      amount,
      direction,
      rules: state.merchantRules,
    });

    return {
      id: `csv_tx_${Date.now()}_${index}`,
      householdId: state.household.id,
      accountId: transaction.accountId ?? state.accounts[0]?.id ?? "acct_1",
      provider: "csv",
      providerTransactionId: transaction.providerTransactionId ?? `csv_${Date.now()}_${index}`,
      sourceType: "csv",
      date,
      postedAt: transaction.postedAt ?? date,
      merchantRaw,
      merchantNormalized: resolved.merchantNormalized,
      descriptionRaw: transaction.descriptionRaw ?? merchantRaw,
      amount,
      direction,
      authorizationStatus: transaction.authorizationStatus ?? "unknown",
      pendingStatus: transaction.pendingStatus ?? "none",
      pendingMatchTransactionId: transaction.pendingMatchTransactionId ?? null,
      sourceAccountName: transaction.sourceAccountName ?? "CSV Statement",
      sourceAccountType: transaction.sourceAccountType ?? "transaction",
      autoCategory: resolved.autoCategory,
      overrideCategory: transaction.overrideCategory ?? null,
      finalCategory: resolved.finalCategory,
      reviewStatus: resolved.needsReview ? "needs_review" : "auto_categorized",
      needsReview: resolved.needsReview,
      notes: transaction.notes ?? null,
      aiSuggestedCategory: null,
      aiConfidence: null,
      aiReason: null,
      isReimbursement: false,
      cycleLabel: getCycleLabelFromDate(date, state.household.cycleStartDay),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Transaction;
  });

  state.transactions.unshift(...normalized);
  return structuredClone(normalized);
}

export function importCsvTransactionsIncrementally(rows: ParsedImportRow[]) {
  const state = getState();
  const accountWatermarks = new Map<string, string>();

  for (const transaction of state.transactions) {
    if (transaction.provider !== "csv") continue;

    const key = `csv:${transaction.sourceAccountName}`;
    const current = accountWatermarks.get(key);
    if (!current || transaction.date > current) {
      accountWatermarks.set(key, transaction.date);
    }
  }

  const { rowsToImport, skippedOlderThanWatermarkCount } = filterRowsForIncrementalImport({
    rows,
    accountWatermarks,
    overlapDays: CSV_IMPORT_OVERLAP_DAYS,
  });

  const existingKeys = new Set(state.transactions.map((transaction) => `${transaction.provider}|${transaction.providerTransactionId}`));
  const uniqueRows = rowsToImport.filter((row) => !existingKeys.has(`csv|${row.providerTransactionId}`));
  const imported = importTransactions(
    uniqueRows.map((row) => ({
      accountId: state.accounts.find((account) => account.sourceAccountName === row.sourceAccountName)?.id ?? state.accounts[0]?.id ?? "acct_1",
      providerTransactionId: row.providerTransactionId,
      postedAt: row.postedAt,
      merchantRaw: row.merchantRaw,
      descriptionRaw: row.descriptionRaw,
      amount: row.amount,
      direction: row.direction,
      sourceAccountName: row.sourceAccountName,
      sourceAccountType: row.sourceAccountType,
      date: row.date,
    })),
  );

  return {
    insertedCount: imported.length,
    alreadyLoadedCount: rowsToImport.length - uniqueRows.length,
    skippedOlderThanWatermarkCount,
    skippedSemanticDuplicateCount: 0,
    matchedPendingCount: 0,
    promotedPendingCount: 0,
    totalRows: rows.length,
  };
}

export function resolvePendingTransaction(transactionId: string, resolution: "confirm_new" | "mark_duplicate") {
  const state = getState();
  const transaction = state.transactions.find((entry) => entry.id === transactionId);

  if (!transaction) {
    throw new Error("Pending transaction not found.");
  }

  transaction.pendingStatus = resolution === "confirm_new" ? "confirmed_new" : "ignored_duplicate";
  transaction.pendingMatchTransactionId = resolution === "confirm_new" ? null : transaction.pendingMatchTransactionId;
  transaction.reviewStatus = "reviewed";
  transaction.updatedAt = new Date().toISOString();

  return structuredClone(transaction);
}

export function saveAiSuggestions(suggestions: AiSuggestion[]) {
  const state = getState();

  for (const suggestion of suggestions) {
    const transaction = state.transactions.find((entry) => entry.id === suggestion.transactionId);

    if (!transaction) {
      continue;
    }

    transaction.aiSuggestedCategory = suggestion.suggestedCategory;
    transaction.aiConfidence = suggestion.confidence;
    transaction.aiReason = suggestion.reason;

    if (suggestion.shouldAutoApply && !transaction.overrideCategory) {
      transaction.finalCategory = suggestion.suggestedCategory;
      transaction.reviewStatus = "reviewed";
      transaction.needsReview = false;
    }
  }

  return getDemoSnapshot();
}
