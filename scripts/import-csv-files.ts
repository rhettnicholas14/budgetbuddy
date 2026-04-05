import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import type { MerchantRule } from "@/lib/domain/types";
import { buildTransactionPayload, dedupeAccounts, parseCsvFile, type ParsedImportRow } from "@/lib/csv/shared";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env. Ensure .env.local includes NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const filePaths = process.argv.slice(2);

  if (filePaths.length === 0) {
    throw new Error("Pass one or more CSV paths. Example: npm run import:csv -- '/path/file1.csv' '/path/file2.csv'");
  }

  const household = await getPrimaryHousehold();
  const merchantRules = await getMerchantRules(household.id);
  const allRows: ParsedImportRow[] = [];

  for (const filePath of filePaths) {
    const content = await readFile(filePath, "utf8");
    allRows.push(...parseCsvFile(filePath, content));
  }

  const uniqueAccounts = dedupeAccounts(allRows);
  const accountIdByKey = await upsertAccounts(household.id, uniqueAccounts);
  const payload = buildTransactionPayload({
    rows: allRows,
    householdId: household.id,
    cycleStartDay: household.cycle_start_day,
    merchantRules,
    accountIdByKey,
  });

  const { data, error } = await supabase
    .from("transactions")
    .upsert(payload, { onConflict: "household_id,provider,provider_transaction_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw error;
  }

  console.log(`Imported or deduped ${payload.length} rows across ${uniqueAccounts.length} accounts. Upsert returned ${data?.length ?? 0} rows.`);
}

async function getPrimaryHousehold() {
  const { data, error } = await supabase
    .from("households")
    .select("id, name, cycle_start_day")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error("No household found. Create the household first.");
  }

  return data;
}

async function getMerchantRules(householdId: string): Promise<MerchantRule[]> {
  const { data, error } = await supabase
    .from("merchant_rules")
    .select("id, household_id, merchant_pattern, normalized_merchant, category_slug, match_type, priority, split_merchant, active")
    .eq("household_id", householdId)
    .order("priority");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    householdId: row.household_id,
    merchantPattern: row.merchant_pattern,
    normalizedMerchant: row.normalized_merchant,
    category: row.category_slug,
    matchType: row.match_type,
    priority: row.priority,
    splitMerchant: row.split_merchant,
    active: row.active,
  }));
}

async function upsertAccounts(householdId: string, rows: ParsedImportRow[]) {
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

void main().catch((error) => {
  console.error("CSV import failed.");
  console.error(error);
  process.exit(1);
});
