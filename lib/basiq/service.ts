import { appEnv, hasBasiqEnv, hasSupabaseEnv } from "@/lib/env";
import { basiqRequest } from "@/lib/basiq/client";
import { getAppSnapshot } from "@/lib/app-data";
import { importTransactions } from "@/lib/mock/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCycleLabelFromDate } from "@/lib/domain/cycle";
import { resolveTransactionCategory } from "@/lib/domain/categorization";

type BasiqUserResponse = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type BasiqAuthLinkResponse = {
  id?: string;
  links?: {
    public?: string;
  };
};

type BasiqConnection = {
  id: string;
  status?: "pending" | "active" | "invalid" | "revoked";
  institution?: {
    id?: string;
    name?: string;
    shortName?: string;
  };
};

type BasiqAccountsResponse = {
  data?: Array<{
    id: string;
    name: string;
    accountNo?: string;
    type?: string;
    balance?: string;
    institution?: {
      name?: string;
      shortName?: string;
    };
  }>;
};

type BasiqTransactionsResponse = {
  data?: Array<{
    id: string;
    amount: string;
    description: string;
    postDate: string;
    status?: string;
    direction: "credit" | "debit";
    account?: string;
  }>;
};

export async function createBasiqConnectLink() {
  const snapshot = await getAppSnapshot();

  if (!hasBasiqEnv()) {
    return {
      url: `${appEnv.appUrl}/settings?mockConnect=1`,
      mode: "mock" as const,
      message: "Mock connect link ready.",
    };
  }

  const basiqUserId = await ensureBasiqUser(snapshot.household.id, snapshot.members[0]?.fullName ?? "Household", snapshot.members[0]?.email ?? "household@example.com");

  let authLinkUrl: string | null = null;

  try {
    const authLink = await basiqRequest<BasiqAuthLinkResponse>(`/users/${basiqUserId}/auth_link`, {
      method: "post",
      body: JSON.stringify({
        redirectUri: `${appEnv.appUrl}/api/basiq/callback?status=connected`,
      }),
    });
    authLinkUrl = authLink.links?.public ?? null;
  } catch {
    const fallbackConnect = await basiqRequest<BasiqAuthLinkResponse>("/connect", {
      method: "post",
      body: JSON.stringify({
        redirectUri: `${appEnv.appUrl}/api/basiq/callback?status=connected`,
        scope: "SERVER_ACCESS",
      }),
    });
    authLinkUrl = fallbackConnect.links?.public ?? null;
  }

  await persistConnectionState(snapshot.household.id, {
    basiqUserId,
    status: "pending",
    authLinkUrl,
  });

  return {
    url: authLinkUrl ?? `${appEnv.appUrl}/settings?basiq=pending`,
    mode: "live" as const,
    message: authLinkUrl ? "Basiq connect link created." : "Basiq user created, but no public auth link was returned.",
  };
}

export async function syncBasiqTransactions() {
  const snapshot = await getAppSnapshot();

  if (!hasBasiqEnv()) {
    return importTransactions([
      {
        merchantRaw: "Mock Basiq Sync - Woolworths",
        descriptionRaw: "Mock Basiq Sync - Woolworths",
        amount: 128.44,
        direction: "debit",
        date: new Date().toISOString(),
        sourceAccountName: snapshot.accounts[0]?.sourceAccountName,
      },
    ]);
  }

  const connection = snapshot.bankConnections.find((entry) => entry.provider === "basiq");

  if (!connection?.basiqUserId) {
    throw new Error("No Basiq user is linked to this household yet. Connect a bank first.");
  }

  const [connectionsResponse, accountsResponse, transactionsResponse] = await Promise.all([
    basiqRequest<{ data?: BasiqConnection[] }>(`/users/${connection.basiqUserId}/connections`),
    basiqRequest<BasiqAccountsResponse>(`/users/${connection.basiqUserId}/accounts`),
    basiqRequest<BasiqTransactionsResponse>(`/users/${connection.basiqUserId}/transactions?limit=500`),
  ]);

  const primaryConnection = connectionsResponse.data?.[0];

  const syncedAccounts = await upsertAccounts(snapshot.household.id, accountsResponse.data ?? []);

  const preparedTransactions = (transactionsResponse.data ?? []).map((entry, index) => {
    const merchantRaw = entry.description;
    const amount = Math.abs(Number(entry.amount));
    const resolved = resolveTransactionCategory({
      merchantRaw,
      descriptionRaw: entry.description,
      overrideCategory: null,
      amount,
      direction: entry.direction,
      rules: snapshot.merchantRules,
    });

    const matchedAccount = syncedAccounts.find((account) => account.providerAccountId === entry.account) ?? syncedAccounts[0];

    return {
      household_id: snapshot.household.id,
      account_id: matchedAccount?.id ?? snapshot.accounts[0]?.id,
      provider: "basiq",
      provider_transaction_id: entry.id ?? `basiq_${index}`,
      source_type: "bank_feed",
      date: entry.postDate,
      posted_at: entry.postDate,
      merchant_raw: merchantRaw,
      merchant_normalized: resolved.merchantNormalized,
      description_raw: entry.description,
      amount,
      direction: entry.direction,
      source_account_name: matchedAccount?.sourceAccountName ?? "Connected Account",
      source_account_type: matchedAccount?.sourceAccountType ?? "transaction",
      auto_category: resolved.autoCategory,
      override_category: null,
      final_category: resolved.finalCategory,
      review_status: resolved.needsReview ? "needs_review" : "auto_categorized",
      notes: null,
      ai_suggested_category: null,
      ai_confidence: null,
      ai_reason: null,
      is_reimbursement: false,
      cycle_label: getCycleLabelFromDate(entry.postDate, snapshot.household.cycleStartDay),
    };
  });

  if (!hasSupabaseEnv()) {
    return importTransactions(
      preparedTransactions.map((transaction) => ({
        merchantRaw: transaction.merchant_raw,
        descriptionRaw: transaction.description_raw,
        amount: transaction.amount,
        direction: transaction.direction,
        date: transaction.date,
        sourceAccountName: transaction.source_account_name,
      })),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("transactions").upsert(preparedTransactions, {
    onConflict: "household_id,provider,provider_transaction_id",
    ignoreDuplicates: true,
  });

  if (error) {
    throw error;
  }

  await persistConnectionState(snapshot.household.id, {
    basiqUserId: connection.basiqUserId,
    externalConnectionId: primaryConnection?.id ?? connection.externalConnectionId,
    institutionCode: primaryConnection?.institution?.shortName ?? connection.institutionCode,
    institutionName: primaryConnection?.institution?.name ?? connection.institutionName,
    status: mapConnectionStatus(primaryConnection?.status),
    authLinkUrl: connection.authLinkUrl,
    lastSyncedAt: new Date().toISOString(),
  });

  return data ?? [];
}

async function ensureBasiqUser(householdId: string, fullName: string, email: string) {
  const existing = await getStoredBasiqConnection(householdId);

  if (existing?.basiq_user_id) {
    return existing.basiq_user_id;
  }

  const [firstName, ...rest] = fullName.split(" ").filter(Boolean);
  const mobile = appEnv.basiqMobile.trim();
  const createdUser = await basiqRequest<BasiqUserResponse>("/users", {
    method: "post",
    body: JSON.stringify({
      email,
      firstName: firstName ?? "Household",
      lastName: rest.join(" ") || "User",
      ...(mobile ? { mobile } : {}),
    }),
  });

  return createdUser.id;
}

async function getStoredBasiqConnection(householdId: string) {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("household_bank_connections")
    .select("*")
    .eq("household_id", householdId)
    .eq("provider", "basiq")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function persistConnectionState(
  householdId: string,
  input: {
    basiqUserId: string;
    externalConnectionId?: string | null;
    authLinkUrl?: string | null;
    institutionCode?: string | null;
    institutionName?: string | null;
    status: "pending" | "active" | "invalid" | "revoked" | "syncing";
    lastSyncedAt?: string | null;
  },
) {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const existing = await getStoredBasiqConnection(householdId);

  if (existing?.id) {
    return supabase
      .from("household_bank_connections")
      .update({
        external_connection_id: input.externalConnectionId ?? existing.external_connection_id ?? null,
        auth_link_url: input.authLinkUrl ?? existing.auth_link_url ?? null,
        institution_code: input.institutionCode ?? existing.institution_code ?? null,
        institution_name: input.institutionName ?? existing.institution_name ?? null,
        status: input.status,
        last_synced_at: input.lastSyncedAt ?? existing.last_synced_at ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }

  return supabase.from("household_bank_connections").insert({
    household_id: householdId,
    provider: "basiq",
    basiq_user_id: input.basiqUserId,
    external_connection_id: input.externalConnectionId ?? null,
    auth_link_url: input.authLinkUrl ?? null,
    institution_code: input.institutionCode ?? null,
    institution_name: input.institutionName ?? null,
    status: input.status,
    last_synced_at: input.lastSyncedAt ?? null,
  });
}

async function upsertAccounts(
  householdId: string,
  accounts: NonNullable<BasiqAccountsResponse["data"]>,
) {
  if (!hasSupabaseEnv()) {
    return accounts.map((account, index) => ({
      id: `mock_account_${index}`,
      providerAccountId: account.id,
      sourceAccountName: account.name,
      sourceAccountType: mapAccountType(account.type),
    }));
  }

  const supabase = await createSupabaseServerClient();
  const payload = accounts.map((account) => ({
    household_id: householdId,
    provider: "basiq",
    provider_account_id: account.id,
    institution_name: account.institution?.name ?? account.institution?.shortName ?? "Connected Bank",
    source_account_name: account.name,
    source_account_type: mapAccountType(account.type),
    balance: Number(account.balance ?? 0),
    mask: account.accountNo?.slice(-4) ?? null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data } = await supabase
    .from("accounts")
    .upsert(payload, { onConflict: "household_id,provider,provider_account_id" })
    .select("id, provider_account_id, source_account_name, source_account_type");

  return (data ?? []).map((account) => ({
    id: account.id,
    providerAccountId: account.provider_account_id,
    sourceAccountName: account.source_account_name,
    sourceAccountType: account.source_account_type,
  }));
}

function mapAccountType(type?: string | null) {
  const normalized = String(type ?? "").toLowerCase();

  if (normalized.includes("credit")) {
    return "credit_card" as const;
  }
  if (normalized.includes("sav")) {
    return "savings" as const;
  }
  if (normalized.includes("loan")) {
    return "loan" as const;
  }

  return "transaction" as const;
}

function mapConnectionStatus(status?: string | null) {
  if (status === "active") {
    return "active" as const;
  }
  if (status === "invalid") {
    return "invalid" as const;
  }
  if (status === "revoked") {
    return "revoked" as const;
  }

  return "pending" as const;
}
