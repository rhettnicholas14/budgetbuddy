import { redirect } from "next/navigation";
import { appEnv, hasSupabaseEnv } from "@/lib/env";
import { categories } from "@/lib/domain/categories";
import { getCycleLabelFromDate } from "@/lib/domain/cycle";
import {
  getDemoSnapshot,
  addMerchantRule,
  editMerchantRule,
  removeMerchantRule,
  reapplyMerchantRulesToTransactions as reapplyMerchantRulesToTransactionsMock,
  resolvePendingTransaction as resolvePendingTransactionMock,
  saveAiSuggestions,
  updateTransactionCategory,
} from "@/lib/mock/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveTransactionCategory } from "@/lib/domain/categorization";
import type { AiSuggestion, AppSnapshot, BankConnection, CategoryKind, MerchantRule, PendingStatus, Transaction } from "@/lib/domain/types";

type HouseholdMemberRow = {
  id: string;
  household_id: string;
  role: "owner" | "member";
  profiles?: {
    full_name?: string | null;
  } | null;
};

type AccountRow = {
  id: string;
  household_id: string;
  provider: "basiq" | "csv" | "manual";
  source_account_name: string;
  source_account_type: Transaction["sourceAccountType"];
  institution_name: string;
  mask?: string | null;
  balance?: number | string | null;
};

type SyncRunRow = {
  id: string;
  household_id: string;
  provider: "basiq" | "csv";
  status: "pending" | "success" | "failed";
  started_at: string;
  completed_at?: string | null;
  message?: string | null;
  imported_count: number;
};

type MerchantRuleRow = {
  id: string;
  household_id: string;
  merchant_pattern: string;
  normalized_merchant: string;
  category_slug: MerchantRule["category"];
  match_type: MerchantRule["matchType"];
  priority: number;
  split_merchant: boolean;
  active: boolean;
};

type BankConnectionRow = {
  id: string;
  household_id: string;
  provider: "basiq";
  basiq_user_id: string;
  external_connection_id?: string | null;
  auth_link_url?: string | null;
  institution_code?: string | null;
  institution_name?: string | null;
  status: BankConnection["status"];
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
};

type TransactionRow = {
  id: string;
  household_id: string;
  account_id: string;
  provider: Transaction["provider"];
  provider_transaction_id: string;
  source_type: Transaction["sourceType"];
  date: string;
  posted_at?: string | null;
  merchant_raw: string;
  merchant_normalized: string;
  description_raw: string;
  amount: number | string;
  direction: Transaction["direction"];
  authorization_status?: Transaction["authorizationStatus"];
  pending_status?: PendingStatus;
  pending_match_transaction_id?: string | null;
  source_account_name: string;
  source_account_type: Transaction["sourceAccountType"];
  auto_category: Transaction["autoCategory"];
  override_category: Transaction["overrideCategory"];
  final_category: Transaction["finalCategory"];
  review_status: Transaction["reviewStatus"];
  notes?: string | null;
  ai_suggested_category?: Transaction["aiSuggestedCategory"];
  ai_confidence?: number | string | null;
  ai_reason?: string | null;
  is_reimbursement?: boolean | null;
  cycle_label?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getAppSnapshot(): Promise<AppSnapshot> {
  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return getDemoSnapshot();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .single();

  if (!member?.household_id) {
    return getDemoSnapshot();
  }

  const householdId = member.household_id;

  const [{ data: household }, { data: budgets }, { data: accounts }, { data: merchantRules }, { data: transactions }, { data: syncRuns }, { data: members }, bankConnectionsResult] =
    await Promise.all([
      supabase.from("households").select("*").eq("id", householdId).single(),
      supabase.from("budgets").select("*").eq("household_id", householdId).order("effective_from", { ascending: false }).limit(1),
      supabase.from("accounts").select("*").eq("household_id", householdId).order("source_account_name"),
      supabase.from("merchant_rules").select("*").eq("household_id", householdId).order("priority"),
      supabase.from("transactions").select("*").eq("household_id", householdId).order("date", { ascending: false }),
      supabase.from("sync_runs").select("*").eq("household_id", householdId).order("started_at", { ascending: false }).limit(10),
      supabase
        .from("household_members")
        .select("id, household_id, role, profiles(full_name), user_id")
        .eq("household_id", householdId),
      supabase
        .from("household_bank_connections")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .then((result) => (result.error ? { data: [] } : result)),
    ]);

  return {
    household: {
      id: household?.id ?? householdId,
      name: household?.name ?? "Household",
      cycleStartDay: household?.cycle_start_day ?? 22,
      cycleTarget: Number(household?.cycle_target ?? 8500),
    },
    members: ((members ?? []) as HouseholdMemberRow[]).map((entry) => ({
      id: entry.id,
      householdId: entry.household_id,
      email: user.email ?? "",
      fullName: entry.profiles?.full_name ?? "Member",
      role: entry.role,
    })),
    budget: {
      id: budgets?.[0]?.id ?? "budget_live",
      householdId,
      cycleTarget: Number(budgets?.[0]?.cycle_target ?? 8500),
      lifestyleTarget: Number(budgets?.[0]?.lifestyle_target ?? 1500),
      groceriesTarget: Number(budgets?.[0]?.groceries_target ?? 1600),
      fixedTarget: Number(budgets?.[0]?.fixed_target ?? 2200),
      essentialVariableTarget: Number(budgets?.[0]?.essential_variable_target ?? 700),
      oneOffTarget: Number(budgets?.[0]?.one_off_target ?? 900),
      effectiveFrom: budgets?.[0]?.effective_from ?? new Date().toISOString(),
    },
    accounts: ((accounts ?? []) as AccountRow[]).map((entry) => ({
      id: entry.id,
      householdId: entry.household_id,
      provider: entry.provider,
      sourceAccountName: entry.source_account_name,
      sourceAccountType: entry.source_account_type,
      institutionName: entry.institution_name,
      mask: entry.mask ?? "",
      balance: Number(entry.balance ?? 0),
    })),
    bankConnections: ((bankConnectionsResult.data ?? []) as BankConnectionRow[]).map(mapBankConnection),
    categories,
    merchantRules: ((merchantRules ?? []) as MerchantRuleRow[]).map(mapMerchantRule),
    transactions: ((transactions ?? []) as TransactionRow[]).map(mapTransaction),
    syncRuns: ((syncRuns ?? []) as SyncRunRow[]).map((entry) => ({
      id: entry.id,
      householdId: entry.household_id,
      provider: entry.provider,
      status: entry.status,
      startedAt: entry.started_at,
      completedAt: entry.completed_at ?? null,
      message: entry.message ?? null,
      importedCount: entry.imported_count,
    })),
  };
}

export async function saveTransactionCategory(transactionId: string, category: CategoryKind, notes?: string) {
  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return updateTransactionCategory(transactionId, category, notes);
  }

  if (!transactionId) {
    throw new Error("Missing transaction id.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to save a category override.");
  }

  const normalizedNotes = notes?.trim() ? notes.trim() : null;

  const { data, error } = await supabase
    .from("transactions")
    .update({
      override_category: category,
      final_category: category,
      review_status: "reviewed",
      notes: normalizedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update transaction category.");
  }

  const { error: overrideError } = await supabase.from("manual_transaction_overrides").upsert(
    {
      transaction_id: transactionId,
      household_id: data.household_id,
      category_slug: category,
      note: normalizedNotes,
      created_by: user.id,
    },
    { onConflict: "transaction_id" },
  );

  if (overrideError) {
    throw new Error(overrideError.message);
  }

  return data ? mapTransaction(data) : null;
}

export async function saveMerchantRule(merchantPattern: string, category: CategoryKind, splitMerchant = false) {
  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return addMerchantRule({ merchantPattern, category, splitMerchant });
  }

  const snapshot = await getAppSnapshot();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("merchant_rules")
    .insert({
      household_id: snapshot.household.id,
      merchant_pattern: merchantPattern,
      normalized_merchant: merchantPattern,
      category_slug: category,
      match_type: "exact",
      priority: snapshot.merchantRules.length + 1,
      split_merchant: splitMerchant,
    })
    .select("*")
    .single();

  return data ? mapMerchantRule(data) : null;
}

export async function updateMerchantRule(
  ruleId: string,
  merchantPattern: string,
  category: CategoryKind,
  splitMerchant = false,
  active = true,
) {
  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return editMerchantRule(ruleId, { merchantPattern, category, splitMerchant, active });
  }

  if (!ruleId) {
    throw new Error("Missing merchant rule id.");
  }

  const normalizedMerchant = merchantPattern.trim();

  if (!normalizedMerchant) {
    throw new Error("Merchant pattern is required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("merchant_rules")
    .update({
      merchant_pattern: normalizedMerchant,
      normalized_merchant: normalizedMerchant,
      category_slug: category,
      split_merchant: splitMerchant,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update merchant rule.");
  }

  return mapMerchantRule(data);
}

export async function deleteMerchantRule(ruleId: string) {
  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return removeMerchantRule(ruleId);
  }

  if (!ruleId) {
    throw new Error("Missing merchant rule id.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("merchant_rules").delete().eq("id", ruleId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function reapplyMerchantRulesToTransactions() {
  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return reapplyMerchantRulesToTransactionsMock();
  }

  const snapshot = await getAppSnapshot();
  const supabase = await createSupabaseServerClient();

  const updates = snapshot.transactions.map((transaction) => {
    const resolved = resolveTransactionCategory({
      merchantRaw: transaction.merchantRaw,
      descriptionRaw: transaction.descriptionRaw,
      overrideCategory: transaction.overrideCategory,
      amount: transaction.amount,
      direction: transaction.direction,
      merchantNormalized: transaction.merchantNormalized,
      rules: snapshot.merchantRules,
    });

    return supabase
      .from("transactions")
      .update({
        merchant_normalized: resolved.merchantNormalized,
        auto_category: resolved.autoCategory,
        final_category: resolved.finalCategory,
        review_status: resolved.needsReview
          ? "needs_review"
          : transaction.overrideCategory
            ? "reviewed"
            : "auto_categorized",
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);
  });

  const results = await Promise.all(updates);
  const firstError = results.find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return results.length;
}

export async function resolvePendingTransaction(transactionId: string, resolution: "confirm_new" | "mark_duplicate") {
  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return resolvePendingTransactionMock(transactionId, resolution);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      pending_status: resolution === "confirm_new" ? "confirmed_new" : "ignored_duplicate",
      ...(resolution === "confirm_new" ? { pending_match_transaction_id: null } : {}),
      review_status: "reviewed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to resolve pending transaction.");
  }

  return mapTransaction(data);
}

export async function persistAiSuggestions(suggestions: AiSuggestion[]) {
  if (suggestions.length === 0) {
    return null;
  }

  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return saveAiSuggestions(suggestions);
  }

  const supabase = await createSupabaseServerClient();
  const updates = suggestions.map((suggestion) =>
    supabase
      .from("transactions")
      .update({
        ai_suggested_category: suggestion.suggestedCategory,
        ai_confidence: suggestion.confidence,
        ai_reason: suggestion.reason,
      })
      .eq("id", suggestion.transactionId),
  );

  try {
    await Promise.all(updates);
  } catch {
    return null;
  }

  return true;
}

function mapMerchantRule(entry: MerchantRuleRow): MerchantRule {
  return {
    id: entry.id,
    householdId: entry.household_id,
    merchantPattern: entry.merchant_pattern,
    normalizedMerchant: entry.normalized_merchant,
    category: entry.category_slug,
    matchType: entry.match_type,
    priority: entry.priority,
    splitMerchant: entry.split_merchant,
    active: entry.active,
  };
}

function mapBankConnection(entry: BankConnectionRow): BankConnection {
  return {
    id: entry.id,
    householdId: entry.household_id,
    provider: entry.provider,
    basiqUserId: entry.basiq_user_id,
    externalConnectionId: entry.external_connection_id ?? null,
    authLinkUrl: entry.auth_link_url ?? null,
    institutionCode: entry.institution_code ?? null,
    institutionName: entry.institution_name ?? null,
    status: entry.status,
    lastSyncedAt: entry.last_synced_at ?? null,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  };
}

function mapTransaction(entry: TransactionRow): Transaction {
  return {
    id: entry.id,
    householdId: entry.household_id,
    accountId: entry.account_id,
    provider: entry.provider,
    providerTransactionId: entry.provider_transaction_id,
    sourceType: entry.source_type,
    date: entry.date,
    postedAt: entry.posted_at ?? entry.date,
    merchantRaw: entry.merchant_raw,
    merchantNormalized: entry.merchant_normalized,
    descriptionRaw: entry.description_raw,
    amount: Number(entry.amount),
    direction: entry.direction,
    authorizationStatus: entry.authorization_status ?? "unknown",
    pendingStatus: entry.pending_status ?? "none",
    pendingMatchTransactionId: entry.pending_match_transaction_id ?? null,
    sourceAccountName: entry.source_account_name,
    sourceAccountType: entry.source_account_type,
    autoCategory: entry.auto_category,
    overrideCategory: entry.override_category,
    finalCategory: entry.final_category,
    reviewStatus: entry.review_status,
    needsReview: entry.review_status === "needs_review",
    notes: entry.notes ?? null,
    aiSuggestedCategory: entry.ai_suggested_category ?? null,
    aiConfidence: entry.ai_confidence == null ? null : Number(entry.ai_confidence),
    aiReason: entry.ai_reason ?? null,
    isReimbursement: entry.is_reimbursement ?? false,
    cycleLabel: entry.cycle_label ?? getCycleLabelFromDate(entry.date),
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  };
}
