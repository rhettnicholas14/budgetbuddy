import Papa from "papaparse";
import { format, parse } from "date-fns";
import { getCycleLabelFromDate } from "@/lib/domain/cycle";
import { normalizeMerchant } from "@/lib/domain/merchant-normalization";
import { resolveTransactionCategory } from "@/lib/domain/categorization";
import type { MerchantRule, Transaction } from "@/lib/domain/types";

type CardCsvRow = {
  Date: string;
  Amount: string;
  "Account Number": string;
  "Transaction Details": string;
  "Merchant Name": string;
  "Processed On": string;
  "Transaction Type": string;
};

type OffsetCsvRow = {
  "Transaction Date": string;
  Details: string;
  Account: string;
  Debit: string;
  Credit: string;
  "Original Description": string;
};

type GenericCsvRow = Record<string, string>;

export type ParsedImportRow = {
  providerTransactionId: string;
  accountKey: string;
  accountName: string;
  accountType: "transaction" | "credit_card" | "savings";
  institutionName: string;
  date: string;
  postedAt: string;
  merchantRaw: string;
  descriptionRaw: string;
  amount: number;
  direction: "debit" | "credit";
  sourceAccountName: string;
  sourceAccountType: "transaction" | "credit_card" | "savings";
};

export function parseCsvFile(filename: string, csvText: string): ParsedImportRow[] {
  if (csvText.startsWith("Date,Amount,Account Number")) {
    return parseCardCsv(filename, csvText);
  }

  if (csvText.startsWith("Transaction Date,Details,Account")) {
    return parseOffsetCsv(filename, csvText);
  }

  return parseGenericCsv(filename, csvText);
}

export function dedupeAccounts(rows: ParsedImportRow[]) {
  const map = new Map<string, ParsedImportRow>();

  for (const row of rows) {
    if (!map.has(row.accountKey)) {
      map.set(row.accountKey, row);
    }
  }

  return [...map.values()];
}

export function buildTransactionPayload({
  rows,
  householdId,
  cycleStartDay,
  merchantRules,
  accountIdByKey,
}: {
  rows: ParsedImportRow[];
  householdId: string;
  cycleStartDay: number;
  merchantRules: MerchantRule[];
  accountIdByKey: Map<string, string>;
}) {
  return rows.map((row) => {
    const resolved = resolveTransactionCategory({
      merchantRaw: row.merchantRaw,
      descriptionRaw: row.descriptionRaw,
      overrideCategory: null,
      amount: row.amount,
      direction: row.direction,
      rules: merchantRules,
    });

    return {
      household_id: householdId,
      account_id: accountIdByKey.get(row.accountKey) ?? null,
      provider: "csv",
      provider_transaction_id: row.providerTransactionId,
      source_type: "csv",
      date: row.date,
      posted_at: row.postedAt,
      merchant_raw: row.merchantRaw,
      merchant_normalized: resolved.merchantNormalized,
      description_raw: row.descriptionRaw,
      amount: row.amount,
      direction: row.direction,
      source_account_name: row.sourceAccountName,
      source_account_type: row.sourceAccountType,
      auto_category: resolved.autoCategory,
      override_category: null,
      final_category: resolved.finalCategory,
      review_status: resolved.needsReview ? "needs_review" : "auto_categorized",
      notes: null,
      is_reimbursement: false,
      cycle_label: getCycleLabelFromDate(row.date, cycleStartDay),
    };
  });
}

export function buildMockTransactions({
  rows,
  householdId,
  cycleStartDay,
  merchantRules,
}: {
  rows: ParsedImportRow[];
  householdId: string;
  cycleStartDay: number;
  merchantRules: MerchantRule[];
}): Partial<Transaction>[] {
  return rows.map((row) => {
    const resolved = resolveTransactionCategory({
      merchantRaw: row.merchantRaw,
      descriptionRaw: row.descriptionRaw,
      overrideCategory: null,
      amount: row.amount,
      direction: row.direction,
      rules: merchantRules,
    });

    return {
      householdId,
      provider: "csv",
      providerTransactionId: row.providerTransactionId,
      sourceType: "csv",
      date: row.date,
      postedAt: row.postedAt,
      merchantRaw: row.merchantRaw,
      merchantNormalized: resolved.merchantNormalized,
      descriptionRaw: row.descriptionRaw,
      amount: row.amount,
      direction: row.direction,
      sourceAccountName: row.sourceAccountName,
      sourceAccountType: row.sourceAccountType,
      autoCategory: resolved.autoCategory,
      overrideCategory: null,
      finalCategory: resolved.finalCategory,
      reviewStatus: resolved.needsReview ? "needs_review" : "auto_categorized",
      needsReview: resolved.needsReview,
      notes: null,
      isReimbursement: false,
      cycleLabel: getCycleLabelFromDate(row.date, cycleStartDay),
    };
  });
}

function parseCardCsv(filename: string, content: string): ParsedImportRow[] {
  const parsed = Papa.parse<CardCsvRow>(content, { header: true, skipEmptyLines: true });

  return parsed.data.map((row, index) => {
    const date = formatDate(row.Date, "dd MMM yy");
    const amount = Math.abs(Number(row.Amount));
    const merchantRaw = row["Merchant Name"]?.trim() || deriveMerchantFromDetails(row["Transaction Details"]);
    const accountName = row["Account Number"]?.trim() || "Card";

    return {
      providerTransactionId: `csv:${filename}:${index}:${row.Date}:${row.Amount}:${row["Transaction Details"]}`,
      accountKey: `csv:${accountName}`,
      accountName,
      accountType: "credit_card",
      institutionName: inferInstitution(accountName, row["Transaction Details"]),
      date,
      postedAt: row["Processed On"] ? formatDate(row["Processed On"], "dd MMM yy") : date,
      merchantRaw,
      descriptionRaw: row["Transaction Details"]?.trim() || merchantRaw,
      amount,
      direction: Number(row.Amount) < 0 ? "debit" : "credit",
      sourceAccountName: accountName,
      sourceAccountType: "credit_card",
    };
  });
}

function parseOffsetCsv(filename: string, content: string): ParsedImportRow[] {
  const parsed = Papa.parse<OffsetCsvRow>(content, { header: true, skipEmptyLines: true });

  return parsed.data.map((row, index) => {
    const debit = row.Debit ? Number(row.Debit) : 0;
    const credit = row.Credit ? Number(row.Credit) : 0;
    const amount = Math.abs(debit || credit);
    const direction = debit > 0 ? "debit" : "credit";
    const descriptionRaw = row["Original Description"]?.trim() || row.Details?.trim() || "Offset transaction";
    const merchantRaw = deriveMerchantFromOffsetRow(row);
    const accountName = row.Account?.trim() || "Offset";
    const date = formatDate(row["Transaction Date"], "dd MMM yyyy");

    return {
      providerTransactionId: `csv:${filename}:${index}:${row["Transaction Date"]}:${debit}:${credit}:${descriptionRaw}`,
      accountKey: `csv:${accountName}`,
      accountName,
      accountType: "savings",
      institutionName: inferInstitution(accountName, descriptionRaw),
      date,
      postedAt: date,
      merchantRaw,
      descriptionRaw,
      amount,
      direction,
      sourceAccountName: accountName,
      sourceAccountType: "savings",
    };
  });
}

function parseGenericCsv(filename: string, content: string): ParsedImportRow[] {
  const parsed = Papa.parse<GenericCsvRow>(content, { header: true, skipEmptyLines: true });

  return parsed.data.map((row, index) => {
    const merchantRaw = row.merchant ?? row.description ?? row.payee ?? `CSV Merchant ${index + 1}`;
    const amount = Math.abs(Number(row.amount ?? row.debit ?? row.value ?? row.Debit ?? row.Credit ?? 0));
    const direction =
      row.direction?.toLowerCase() === "credit" ||
      Number(row.amount ?? row.Credit ?? 0) > 0 && Number(row.debit ?? row.Debit ?? 0) === 0
        ? "credit"
        : "debit";
    const date = normalizeDate(row.date ?? row.posted_at ?? row.Date ?? row["Transaction Date"] ?? "");
    const accountName = row.account ?? row.Account ?? "CSV Import";

    return {
      providerTransactionId: `csv:${filename}:${index}:${date}:${merchantRaw}:${amount}`,
      accountKey: `csv:${accountName}`,
      accountName,
      accountType: "transaction",
      institutionName: inferInstitution(accountName, merchantRaw),
      date: date || format(new Date(), "yyyy-MM-dd"),
      postedAt: date || format(new Date(), "yyyy-MM-dd"),
      merchantRaw,
      descriptionRaw: row.description ?? row.Details ?? merchantRaw,
      amount,
      direction,
      sourceAccountName: accountName,
      sourceAccountType: "transaction",
    };
  });
}

function deriveMerchantFromDetails(details: string) {
  return normalizeMerchant(details || "Unknown Merchant");
}

function deriveMerchantFromOffsetRow(row: OffsetCsvRow) {
  const details = `${row.Details ?? ""} ${row["Original Description"] ?? ""}`;

  if (/medicare/i.test(details)) return "Medicare";
  if (/accenture/i.test(details)) return "Salary";
  if (/home loan/i.test(details)) return "Mortgage";
  if (/hugo jack nicholas|linked account xx2326|linked account xx3477/i.test(details)) return "Kids Savings";
  if (/american express/i.test(details)) return "Credit Card Payment";
  if (/bills/i.test(details)) return "Bills";
  if (/funds transfer|receipt number/i.test(details)) return "Transfer";
  if (/inspire/i.test(details)) return "Transfer";

  return normalizeMerchant(row.Details || row["Original Description"] || "Offset Transaction");
}

function inferInstitution(accountName: string, description: string) {
  const haystack = `${accountName} ${description}`.toLowerCase();
  if (haystack.includes("nab")) return "NAB";
  if (haystack.includes("amex") || haystack.includes("american express")) return "American Express";
  if (haystack.includes("offset")) return "Macquarie";
  return "Imported CSV";
}

function formatDate(value: string, pattern: string) {
  return format(parse(value.trim(), pattern, new Date()), "yyyy-MM-dd");
}

function normalizeDate(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  for (const pattern of ["dd MMM yy", "dd MMM yyyy", "yyyy-MM-dd"]) {
    try {
      return format(parse(trimmed, pattern, new Date()), "yyyy-MM-dd");
    } catch {
      continue;
    }
  }

  return "";
}
