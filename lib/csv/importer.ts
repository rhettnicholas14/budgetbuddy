import { getAppSnapshot } from "@/lib/app-data";
import { importCsvTransactionsIncrementally } from "@/lib/mock/store";
import { appEnv, hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CSV_IMPORT_OVERLAP_DAYS,
  CSV_SEMANTIC_DEDUPE_WINDOW_DAYS,
  buildSemanticDuplicateKey,
  buildTransactionPayload,
  dedupeAccounts,
  filterRowsForIncrementalImport,
  parseCsvFile,
} from "@/lib/csv/shared";

type CsvImportResult = {
  insertedCount: number;
  alreadyLoadedCount: number;
  skippedOlderThanWatermarkCount: number;
  skippedSemanticDuplicateCount: number;
  matchedPendingCount: number;
  promotedPendingCount: number;
  totalRows: number;
  message: string;
};

export async function importCsvText(filename: string, csvText: string): Promise<CsvImportResult> {
  const snapshot = await getAppSnapshot();
  const rows = parseCsvFile(filename, csvText);

  if (appEnv.mockMode || !hasSupabaseEnv()) {
    const summary = importCsvTransactionsIncrementally(rows);

    return {
      ...summary,
      message: buildImportSummaryMessage(summary),
    };
  }

  const supabase = await createSupabaseServerClient();
  const accountIdByKey = await upsertCsvAccounts({
    supabase,
    householdId: snapshot.household.id,
    rows: dedupeAccounts(rows),
  });

  const accountWatermarks = await getCsvAccountWatermarks({
    supabase,
    householdId: snapshot.household.id,
  });

  const { rowsToImport, skippedOlderThanWatermarkCount } = filterRowsForIncrementalImport({
    rows,
    accountWatermarks,
    overlapDays: CSV_IMPORT_OVERLAP_DAYS,
  });

  const {
    rowsToImport: semanticallyFilteredRows,
    skippedSemanticDuplicateCount,
    matchedPendingCount,
    promotedPendingCount,
    pendingPromotions,
  } = await classifySemanticImports({
    supabase,
    householdId: snapshot.household.id,
    rows: rowsToImport,
  });

  const payload = buildTransactionPayload({
    rows: semanticallyFilteredRows,
    householdId: snapshot.household.id,
    cycleStartDay: snapshot.household.cycleStartDay,
    merchantRules: snapshot.merchantRules,
    accountIdByKey,
  });

  if (payload.length === 0) {
    return {
      insertedCount: 0,
      alreadyLoadedCount: 0,
      skippedOlderThanWatermarkCount,
      skippedSemanticDuplicateCount,
      matchedPendingCount,
      promotedPendingCount,
      totalRows: rows.length,
      message: buildImportSummaryMessage({
        insertedCount: 0,
        alreadyLoadedCount: 0,
        skippedOlderThanWatermarkCount,
        skippedSemanticDuplicateCount,
        matchedPendingCount,
        promotedPendingCount,
        totalRows: rows.length,
      }),
    };
  }

  const { data, error } = await supabase
    .from("transactions")
    .upsert(payload, { onConflict: "household_id,provider,provider_transaction_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw error;
  }

  if (pendingPromotions.length > 0) {
    const promotionUpdates = pendingPromotions.map((promotion) =>
      supabase
        .from("transactions")
        .update({
          provider_transaction_id: promotion.providerTransactionId,
          date: promotion.date,
          posted_at: promotion.postedAt,
          merchant_raw: promotion.merchantRaw,
          description_raw: promotion.descriptionRaw,
          authorization_status: promotion.authorizationStatus,
          pending_status: "none",
          pending_match_transaction_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", promotion.transactionId),
    );

    const promotionResults = await Promise.all(promotionUpdates);
    const promotionError = promotionResults.find((result) => result.error)?.error;

    if (promotionError) {
      throw promotionError;
    }
  }

  const insertedCount = data?.length ?? 0;
  const alreadyLoadedCount = Math.max(payload.length - insertedCount, 0);

  return {
    insertedCount,
    alreadyLoadedCount,
    skippedOlderThanWatermarkCount,
    skippedSemanticDuplicateCount,
    matchedPendingCount,
    promotedPendingCount,
    totalRows: rows.length,
    message: buildImportSummaryMessage({
      insertedCount,
      alreadyLoadedCount,
      skippedOlderThanWatermarkCount,
      skippedSemanticDuplicateCount,
      matchedPendingCount,
      promotedPendingCount,
      totalRows: rows.length,
    }),
  };
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

async function getCsvAccountWatermarks({
  supabase,
  householdId,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  householdId: string;
}) {
  const { data, error } = await supabase
    .from("transactions")
    .select("source_account_name, source_account_type, date")
    .eq("household_id", householdId)
    .eq("provider", "csv")
    .order("date", { ascending: false });

  if (error) {
    throw error;
  }

  const watermarks = new Map<string, string>();

  for (const row of data ?? []) {
    const key = `csv:${row.source_account_name}`;
    if (!watermarks.has(key) && row.date) {
      watermarks.set(key, row.date);
    }
  }

  return watermarks;
}

async function classifySemanticImports({
  supabase,
  householdId,
  rows,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  householdId: string;
  rows: ReturnType<typeof parseCsvFile>;
}) {
  if (rows.length === 0) {
    return {
      rowsToImport: rows,
      skippedSemanticDuplicateCount: 0,
      matchedPendingCount: 0,
      promotedPendingCount: 0,
      pendingPromotions: [] as Array<{
        transactionId: string;
        providerTransactionId: string;
        date: string;
        postedAt: string;
        merchantRaw: string;
        descriptionRaw: string;
        authorizationStatus: "pending" | "posted" | "unknown";
      }>,
    };
  }

  const accountNames = [...new Set(rows.map((row) => row.sourceAccountName))];
  const minimumDate = rows.reduce((minimum, row) => (row.date < minimum ? row.date : minimum), rows[0]?.date ?? "");
  const semanticCutoffDate = new Date(`${minimumDate}T00:00:00`);
  semanticCutoffDate.setDate(semanticCutoffDate.getDate() - CSV_SEMANTIC_DEDUPE_WINDOW_DAYS);
  const cutoffIso = semanticCutoffDate.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("transactions")
    .select("id, source_account_name, merchant_raw, amount, direction, date, posted_at, authorization_status, pending_status")
    .eq("household_id", householdId)
    .eq("provider", "csv")
    .in("source_account_name", accountNames)
    .gte("date", cutoffIso);

  if (error) {
    throw error;
  }

  const existingRows = (data ?? []).map((row) => ({
    id: row.id as string,
    accountKey: `csv:${row.source_account_name}`,
    merchantRaw: row.merchant_raw,
    amount: Number(row.amount),
    direction: row.direction as "debit" | "credit",
    date: row.date as string,
    postedAt: typeof row.posted_at === "string" ? row.posted_at.slice(0, 10) : row.date,
    authorizationStatus: (row.authorization_status ?? "unknown") as "pending" | "posted" | "unknown",
    pendingStatus: (row.pending_status ?? "none") as "none" | "matched" | "confirmed_new" | "ignored_duplicate",
  }));

  const keptRows: typeof rows = [];
  let skippedSemanticDuplicateCount = 0;
  let matchedPendingCount = 0;
  let promotedPendingCount = 0;
  const pendingPromotions: Array<{
    transactionId: string;
    providerTransactionId: string;
    date: string;
    postedAt: string;
    merchantRaw: string;
    descriptionRaw: string;
    authorizationStatus: "pending" | "posted" | "unknown";
  }> = [];

  for (const row of rows) {
    const duplicateAgainstExisting = existingRows.find((existingRow) => isLikelySemanticDuplicate(existingRow, row));
    const duplicateWithinBatch = keptRows.some((keptRow) => isLikelySemanticDuplicate(keptRow, row));

    if (duplicateAgainstExisting) {
      if (row.authorizationStatus !== "pending" && duplicateAgainstExisting.authorizationStatus === "pending") {
        promotedPendingCount += 1;
        pendingPromotions.push({
          transactionId: duplicateAgainstExisting.id,
          providerTransactionId: row.providerTransactionId,
          date: row.date,
          postedAt: row.postedAt,
          merchantRaw: row.merchantRaw,
          descriptionRaw: row.descriptionRaw,
          authorizationStatus: row.authorizationStatus,
        });
        continue;
      }

      if (duplicateAgainstExisting.pendingStatus !== "ignored_duplicate") {
        matchedPendingCount += 1;
        keptRows.push({
          ...row,
          pendingStatus: "matched",
          pendingMatchTransactionId: duplicateAgainstExisting.id,
        });
        continue;
      }

      skippedSemanticDuplicateCount += 1;
      continue;
    }

    if (duplicateWithinBatch) {
      skippedSemanticDuplicateCount += 1;
      continue;
    }

    keptRows.push(row);
  }

  return {
    rowsToImport: keptRows,
    skippedSemanticDuplicateCount,
    matchedPendingCount,
    promotedPendingCount,
    pendingPromotions,
  };
}

function isLikelySemanticDuplicate(
  left: { accountKey: string; merchantRaw: string; amount: number; direction: "debit" | "credit"; date: string; postedAt?: string },
  right: { accountKey: string; merchantRaw: string; amount: number; direction: "debit" | "credit"; date: string; postedAt?: string },
) {
  if (buildSemanticDuplicateKey(left) !== buildSemanticDuplicateKey(right)) {
    return false;
  }

  const leftDates = [left.date, left.postedAt ?? left.date];
  const rightDates = [right.date, right.postedAt ?? right.date];

  return leftDates.some((leftDate) =>
    rightDates.some((rightDate) => Math.abs(diffDays(leftDate, rightDate)) <= CSV_SEMANTIC_DEDUPE_WINDOW_DAYS),
  );
}

function diffDays(left: string, right: string) {
  const leftTime = new Date(`${left}T00:00:00`).getTime();
  const rightTime = new Date(`${right}T00:00:00`).getTime();
  return Math.round((leftTime - rightTime) / 86_400_000);
}

function buildImportSummaryMessage({
  insertedCount,
  alreadyLoadedCount,
  skippedOlderThanWatermarkCount,
  skippedSemanticDuplicateCount,
  matchedPendingCount,
  promotedPendingCount,
  totalRows,
}: {
  insertedCount: number;
  alreadyLoadedCount: number;
  skippedOlderThanWatermarkCount: number;
  skippedSemanticDuplicateCount: number;
  matchedPendingCount: number;
  promotedPendingCount: number;
  totalRows: number;
}) {
  const parts = [`Imported ${insertedCount} new transaction${insertedCount === 1 ? "" : "s"}.`];

  if (alreadyLoadedCount > 0) {
    parts.push(`${alreadyLoadedCount} already loaded.`);
  }

  if (skippedSemanticDuplicateCount > 0) {
    parts.push(
      `${skippedSemanticDuplicateCount} skipped as likely duplicates by account, merchant, amount, and a ${CSV_SEMANTIC_DEDUPE_WINDOW_DAYS}-day window.`,
    );
  }

  if (matchedPendingCount > 0) {
    parts.push(`${matchedPendingCount} added as pending matches for review.`);
  }

  if (promotedPendingCount > 0) {
    parts.push(`${promotedPendingCount} pending transaction${promotedPendingCount === 1 ? "" : "s"} promoted to posted.`);
  }

  if (skippedOlderThanWatermarkCount > 0) {
    parts.push(
      `${skippedOlderThanWatermarkCount} skipped because they were older than the last imported date minus ${CSV_IMPORT_OVERLAP_DAYS} days.`,
    );
  }

  parts.push(`${totalRows} row${totalRows === 1 ? "" : "s"} processed.`);

  return parts.join(" ");
}
