import { getAppSnapshot } from "@/lib/app-data";
import { importTransactions } from "@/lib/mock/store";
import { appEnv, hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildMockTransactions, buildTransactionPayload, dedupeAccounts, parseCsvFile } from "@/lib/csv/shared";

export async function importCsvText(filename: string, csvText: string) {
  const snapshot = await getAppSnapshot();
  const rows = parseCsvFile(filename, csvText);

  if (appEnv.mockMode || !hasSupabaseEnv()) {
    return importTransactions(
      buildMockTransactions({
        rows,
        householdId: snapshot.household.id,
        cycleStartDay: snapshot.household.cycleStartDay,
        merchantRules: snapshot.merchantRules,
      }),
    );
  }

  const supabase = await createSupabaseServerClient();
  const accountIdByKey = await upsertCsvAccounts({
    supabase,
    householdId: snapshot.household.id,
    rows: dedupeAccounts(rows),
  });

  const payload = buildTransactionPayload({
    rows,
    householdId: snapshot.household.id,
    cycleStartDay: snapshot.household.cycleStartDay,
    merchantRules: snapshot.merchantRules,
    accountIdByKey,
  });

  const { data, error } = await supabase
    .from("transactions")
    .upsert(payload, { onConflict: "household_id,provider,provider_transaction_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function upsertCsvAccounts({
  supabase,
  householdId,
  rows,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  householdId: string;
  rows: ReturnType<typeof dedupeAccounts>;
}) {
  const { data: existing, error: existingError } = await supabase
    .from("accounts")
    .select("id, provider_account_id")
    .eq("household_id", householdId)
    .eq("provider", "csv");

  if (existingError) {
    throw existingError;
  }

  const map = new Map((existing ?? []).map((row) => [row.provider_account_id as string, row.id as string]));
  const missing = rows.filter((row) => !map.has(row.accountKey));

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("accounts")
      .insert(
        missing.map((row) => ({
          household_id: householdId,
          provider: "csv",
          provider_account_id: row.accountKey,
          institution_name: row.institutionName,
          source_account_name: row.accountName,
          source_account_type: row.accountType,
          balance: 0,
          mask: row.accountName.match(/(\d{4})$/)?.[1] ?? null,
        })),
      )
      .select("id, provider_account_id");

    if (insertError) {
      throw insertError;
    }

    for (const row of inserted ?? []) {
      map.set(row.provider_account_id as string, row.id as string);
    }
  }

  return map;
}
