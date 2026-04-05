import { subDays } from "date-fns";
import { categories } from "@/lib/domain/categories";
import { getCycleLabelFromDate } from "@/lib/domain/cycle";
import { resolveTransactionCategory } from "@/lib/domain/categorization";
import type {
  Account,
  AppSnapshot,
  BankConnection,
  Budget,
  Household,
  HouseholdMember,
  MerchantRule,
  SyncRun,
  Transaction,
} from "@/lib/domain/types";

const household: Household = {
  id: "hh_demo",
  name: "Nicholas Household",
  cycleStartDay: 22,
  cycleTarget: 8500,
};

const members: HouseholdMember[] = [
  { id: "mem_1", householdId: household.id, email: "you@example.com", fullName: "You", role: "owner" },
  { id: "mem_2", householdId: household.id, email: "wife@example.com", fullName: "Wife", role: "member" },
];

const budget: Budget = {
  id: "budget_1",
  householdId: household.id,
  cycleTarget: 8500,
  lifestyleTarget: 1500,
  groceriesTarget: 1600,
  fixedTarget: 2200,
  essentialVariableTarget: 700,
  oneOffTarget: 900,
  effectiveFrom: new Date().toISOString(),
};

const accounts: Account[] = [
  {
    id: "acct_1",
    householdId: household.id,
    provider: "basiq",
    sourceAccountName: "NAB Everyday",
    sourceAccountType: "transaction",
    institutionName: "NAB",
    mask: "1234",
    balance: 5820,
  },
  {
    id: "acct_2",
    householdId: household.id,
    provider: "basiq",
    sourceAccountName: "Macquarie Offset",
    sourceAccountType: "savings",
    institutionName: "Macquarie",
    mask: "4321",
    balance: 21780,
  },
  {
    id: "acct_3",
    householdId: household.id,
    provider: "basiq",
    sourceAccountName: "NAB Rewards CC",
    sourceAccountType: "credit_card",
    institutionName: "NAB",
    mask: "9988",
    balance: -1860,
  },
];

const bankConnections: BankConnection[] = [
  {
    id: "bank_conn_1",
    householdId: household.id,
    provider: "basiq",
    basiqUserId: "mock_basiq_user_1",
    externalConnectionId: "mock_connection_1",
    authLinkUrl: null,
    institutionCode: "NAB",
    institutionName: "NAB",
    status: "active",
    lastSyncedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const seededMerchantRules: MerchantRule[] = [
  ["Woolworths", "groceries"],
  ["Coles", "groceries"],
  ["ALDI", "groceries"],
  ["Bakers Delight", "groceries"],
  ["IGA", "groceries"],
  ["Telstra", "fixed_cc"],
  ["Youi", "fixed_cc"],
  ["Medibank", "fixed_cc"],
  ["Powershop", "fixed_cc"],
  ["Netflix", "fixed_cc"],
  ["Stan", "fixed_cc"],
  ["Disney+", "fixed_cc"],
  ["Apple", "review"],
  ["Amazon", "review"],
  ["Linkt", "fixed_cc"],
  ["YMCA", "fixed_cc"],
  ["Club Lime", "fixed_cc"],
  ["Netlify", "fixed_cc"],
  ["7-Eleven", "essential_variable"],
  ["Chemist Warehouse", "essential_variable"],
  ["Amcal", "essential_variable"],
  ["Square", "lifestyle"],
  ["Uber Eats", "lifestyle"],
  ["Dan Murphy's", "lifestyle"],
  ["Uber", "lifestyle"],
  ["Kmart", "lifestyle"],
  ["Qantas", "one_off"],
  ["Cabrini", "one_off"],
  ["Dr Anita Yuen", "one_off"],
  ["Salary", "income"],
  ["Medicare", "rebate"],
  ["CCS", "childcare_rebate"],
  ["Mortgage", "mortgage"],
  ["Mortgage Extra", "mortgage_extra"],
  ["Childcare", "childcare"],
  ["Kids Savings", "kids_savings"],
  ["Credit Card Payment", "transfer"],
].map(([merchantPattern, category], index) => ({
  id: `rule_${index + 1}`,
  householdId: household.id,
  merchantPattern,
  normalizedMerchant: merchantPattern,
  category: category as MerchantRule["category"],
  matchType: "exact",
  priority: index + 1,
  splitMerchant: category === "review",
  active: true,
}));

const baseTransactions = [
  ["Woolworths Hawthorn East", 182.34, "debit", "acct_1", 2],
  ["Woolworths Online", 231.17, "debit", "acct_1", 5],
  ["Telstra", 92, "debit", "acct_3", 7],
  ["Powershop", 165, "debit", "acct_3", 8],
  ["Uber Eats", 48.5, "debit", "acct_1", 1],
  ["Square Cafe", 24.5, "debit", "acct_1", 3],
  ["Amazon Marketplace", 116.2, "debit", "acct_3", 4],
  ["Apple.com/Bill", 18.99, "debit", "acct_3", 6],
  ["Dan Murphys Camberwell", 82.6, "debit", "acct_1", 9],
  ["7-Eleven Fuel", 78.4, "debit", "acct_1", 10],
  ["Chemist Warehouse", 32.3, "debit", "acct_1", 11],
  ["Qantas", 920, "debit", "acct_3", 12],
  ["Salary Payment", 6400, "credit", "acct_2", 13],
  ["Medicare Benefit", 180, "credit", "acct_2", 14],
  ["CCS Benefit", 720, "credit", "acct_2", 15],
  ["Mortgage", 3100, "debit", "acct_2", 16],
  ["Childcare Centre", 540, "debit", "acct_2", 17],
  ["Credit Card Payment", 1800, "debit", "acct_2", 18],
  ["Kmart Hawthorn", 67.4, "debit", "acct_1", 19],
  ["Uber Trip", 18.2, "debit", "acct_1", 20],
] as const;

const transactions: Transaction[] = baseTransactions.map(([merchantRaw, amount, direction, accountId, daysAgo], index) => {
  const date = subDays(new Date(), daysAgo).toISOString();
  const resolved = resolveTransactionCategory({
    merchantRaw,
    descriptionRaw: merchantRaw,
    overrideCategory: null,
    amount,
    direction,
    rules: seededMerchantRules,
  });

  return {
    id: `tx_${index + 1}`,
    householdId: household.id,
    accountId,
    provider: "basiq",
    providerTransactionId: `provider_tx_${index + 1}`,
    sourceType: "bank_feed",
    date,
    postedAt: date,
    merchantRaw,
    merchantNormalized: resolved.merchantNormalized,
    descriptionRaw: merchantRaw,
    amount,
    direction,
    sourceAccountName: accounts.find((account) => account.id === accountId)?.sourceAccountName ?? "Unknown",
    sourceAccountType: accounts.find((account) => account.id === accountId)?.sourceAccountType ?? "transaction",
    autoCategory: resolved.autoCategory,
    overrideCategory: null,
    finalCategory: resolved.finalCategory,
    reviewStatus: resolved.needsReview ? "needs_review" : "auto_categorized",
    needsReview: resolved.needsReview,
    notes: resolved.needsReview ? "Needs review for split merchant or unusual spend." : null,
    aiSuggestedCategory: null,
    aiConfidence: null,
    aiReason: null,
    isReimbursement: merchantRaw === "Medicare Benefit",
    cycleLabel: getCycleLabelFromDate(date, household.cycleStartDay),
    createdAt: date,
    updatedAt: date,
  };
});

const syncRuns: SyncRun[] = [
  {
    id: "sync_1",
    householdId: household.id,
    provider: "basiq",
    status: "success",
    startedAt: subDays(new Date(), 1).toISOString(),
    completedAt: subDays(new Date(), 1).toISOString(),
    message: "Imported 28 transactions from NAB and Macquarie.",
    importedCount: 28,
  },
];

export function createDemoSnapshot(): AppSnapshot {
  return {
    household,
    members,
    budget,
    accounts,
    bankConnections,
    categories,
    merchantRules: seededMerchantRules,
    transactions,
    syncRuns,
  };
}
