export type CategoryKind =
  | "bills"
  | "fixed_cc"
  | "groceries"
  | "essential_variable"
  | "lifestyle"
  | "one_off"
  | "mortgage"
  | "mortgage_extra"
  | "childcare"
  | "childcare_rebate"
  | "transfer"
  | "kids_savings"
  | "rebate"
  | "income"
  | "review"
  | "uncategorized";

export type ReviewStatus = "needs_review" | "reviewed" | "auto_categorized";
export type SyncStatus = "pending" | "success" | "failed";
export type SourceType = "bank_feed" | "csv" | "manual";
export type AccountType = "transaction" | "credit_card" | "savings" | "loan";
export type Direction = "debit" | "credit";

export type Category = {
  id: string;
  slug: CategoryKind;
  label: string;
  group: "spend" | "offset" | "ignore";
  budgeted: boolean;
  reviewByDefault?: boolean;
  accent: string;
};

export type Household = {
  id: string;
  name: string;
  cycleStartDay: number;
  cycleTarget: number;
};

export type HouseholdMember = {
  id: string;
  householdId: string;
  email: string;
  fullName: string;
  role: "owner" | "member";
};

export type Budget = {
  id: string;
  householdId: string;
  cycleTarget: number;
  lifestyleTarget: number;
  groceriesTarget: number;
  fixedTarget: number;
  essentialVariableTarget: number;
  oneOffTarget: number;
  effectiveFrom: string;
};

export type Account = {
  id: string;
  householdId: string;
  provider: "basiq" | "csv" | "manual";
  sourceAccountName: string;
  sourceAccountType: AccountType;
  institutionName: string;
  mask: string;
  balance: number;
};

export type MerchantRule = {
  id: string;
  householdId: string;
  merchantPattern: string;
  normalizedMerchant: string;
  category: CategoryKind;
  matchType: "exact" | "contains";
  priority: number;
  splitMerchant: boolean;
  active: boolean;
};

export type Transaction = {
  id: string;
  householdId: string;
  accountId: string;
  provider: "basiq" | "csv" | "manual";
  providerTransactionId: string;
  sourceType: SourceType;
  date: string;
  postedAt: string;
  merchantRaw: string;
  merchantNormalized: string;
  descriptionRaw: string;
  amount: number;
  direction: Direction;
  sourceAccountName: string;
  sourceAccountType: AccountType;
  autoCategory: CategoryKind | null;
  overrideCategory: CategoryKind | null;
  finalCategory: CategoryKind;
  reviewStatus: ReviewStatus;
  needsReview: boolean;
  notes: string | null;
  aiSuggestedCategory?: CategoryKind | null;
  aiConfidence?: number | null;
  aiReason?: string | null;
  isReimbursement: boolean;
  cycleLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type SyncRun = {
  id: string;
  householdId: string;
  provider: "basiq" | "csv";
  status: SyncStatus;
  startedAt: string;
  completedAt: string | null;
  message: string | null;
  importedCount: number;
};

export type BankConnection = {
  id: string;
  householdId: string;
  provider: "basiq";
  basiqUserId: string;
  externalConnectionId: string | null;
  authLinkUrl: string | null;
  institutionCode: string | null;
  institutionName: string | null;
  status: "pending" | "active" | "invalid" | "revoked" | "syncing";
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CycleWindow = {
  label: string;
  start: Date;
  end: Date;
  daysElapsed: number;
  totalDays: number;
  progress: number;
};

export type BudgetSummary = {
  totalSpend: number;
  lifestyleSpend: number;
  fixedSpend: number;
  groceriesSpend: number;
  essentialVariableSpend: number;
  oneOffSpend: number;
  mortgageSpend: number;
  operatingSpend: number;
  budgetTrackedSpend: number;
  transferExcludedSpend: number;
  reimbursementExcludedSpend: number;
  remainingBudget: number;
  paceStatus: "on_track" | "over_pace";
  uncategorizedCount: number;
};

export type TrendPoint = {
  label: string;
  fixed_cc: number;
  groceries: number;
  essential_variable: number;
  lifestyle: number;
  one_off: number;
  total: number;
};

export type MerchantTrend = {
  merchant: string;
  current: number;
  previous: number;
  delta: number;
  deltaDirection: "up" | "down" | "flat";
};

export type WeeklyMode = "calendar" | "cycle";

export type WeeklyStatus = {
  label: "On Track" | "Watch It" | "Over Pace";
  tone: "green" | "amber" | "red";
};

export type WeeklyTrackerPoint = {
  label: string;
  weekStart: string;
  weekEnd: string;
  groceries: number;
  lifestyle: number;
  essentialVariable: number;
  fixedCC: number;
  totalSpend: number;
  controlSpend: number;
};

export type WeeklyTrackerSummary = {
  weekStart: string;
  weekEnd: string;
  label: string;
  mode: WeeklyMode;
  groceries: number;
  lifestyle: number;
  essentialVariable: number;
  fixedCC: number;
  totalSpend: number;
  controlSpend: number;
  target: number;
  remaining: number;
  status: WeeklyStatus;
  previousWeekControlSpend: number;
  previousWeekDelta: number;
  previousWeekDeltaPercent: number | null;
  recentAverageControlSpend: number;
  averageWeeklyGroceries: number;
  averageWeeklyLifestyle: number;
  highestLifestyleWeek: WeeklyTrackerPoint | null;
  vsAverageDirection: "above" | "below" | "flat";
  recentTransactions: Transaction[];
  history: WeeklyTrackerPoint[];
};

export type AccountSummary = {
  accountId: string;
  accountName: string;
  institutionName: string;
  accountType: AccountType;
  balance: number;
  transactionCount: number;
  cycleSpend: number;
  lastTransactionDate: string | null;
  reviewCount: number;
};

export type AiSuggestion = {
  transactionId: string;
  suggestedCategory: CategoryKind;
  confidence: number;
  reason: string;
  shouldAutoApply: boolean;
};

export type AiInsight = {
  title: string;
  body: string;
  tone: "positive" | "warning" | "neutral";
};

export type AppSnapshot = {
  household: Household;
  members: HouseholdMember[];
  budget: Budget;
  accounts: Account[];
  bankConnections: BankConnection[];
  categories: Category[];
  merchantRules: MerchantRule[];
  transactions: Transaction[];
  syncRuns: SyncRun[];
};
