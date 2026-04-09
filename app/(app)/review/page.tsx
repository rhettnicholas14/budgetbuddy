import { format } from "date-fns";
import {
  addMerchantRuleAction,
  applyAiSuggestionAction,
  resolvePendingTransactionAction,
  updateTransactionCategoryAction,
} from "@/app/actions";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { StatusBanner } from "@/components/ui/status-banner";
import { getAiSuggestions } from "@/lib/ai/finance-assistant";
import { getAppSnapshot, persistAiSuggestions } from "@/lib/app-data";
import { categories } from "@/lib/domain/categories";
import { formatPreciseCurrency } from "@/lib/domain/format";
import { buildReviewDuplicateMatches } from "@/lib/domain/selectors";
import type { Transaction } from "@/lib/domain/types";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const snapshot = await getAppSnapshot();
  const params = await searchParams;
  const status = String(params.status ?? "");
  const transactionMap = new Map(snapshot.transactions.map((transaction) => [transaction.id, transaction]));
  const duplicateMatchMap = buildReviewDuplicateMatches(snapshot.transactions);

  const duplicateQueue = snapshot.transactions.filter((transaction) => duplicateMatchMap.has(transaction.id));
  const categoryQueue = snapshot.transactions.filter((transaction) => transaction.needsReview && !duplicateMatchMap.has(transaction.id));
  const queueCount = duplicateQueue.length + categoryQueue.length;

  const aiSuggestions = await getAiSuggestions(snapshot, categoryQueue.slice(0, 8));
  await persistAiSuggestions(aiSuggestions);
  const suggestionMap = new Map(aiSuggestions.map((suggestion) => [suggestion.transactionId, suggestion]));

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Review Queue</p>
        <h1 className="text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
          Review duplicates and uncertain categories.
        </h1>
        <p className="text-sm text-slate-600">{queueCount} transactions need attention.</p>
      </div>

      <StatusBanner status={status} />

      {queueCount === 0 ? (
        <Card>
          <p className="text-lg font-semibold text-slate-950">Queue clear</p>
          <p className="mt-2 text-sm text-slate-600">Everything currently has a confident category. Nice quiet moment.</p>
        </Card>
      ) : null}

      {duplicateQueue.length > 0 ? (
        <section className="space-y-3">
          <div className="px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Duplicate Checks</p>
            <p className="mt-1 text-sm text-slate-600">Same merchant and amount within a 7-day window on the same account.</p>
          </div>
          <div className="space-y-3">
            {duplicateQueue.map((transaction) => {
              const duplicateMatchId = transaction.pendingMatchTransactionId ?? duplicateMatchMap.get(transaction.id) ?? null;
              const pendingMatch = duplicateMatchId ? transactionMap.get(duplicateMatchId) : null;

              return (
                <DuplicateCard
                  key={transaction.id}
                  pendingMatch={pendingMatch}
                  transaction={transaction}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {categoryQueue.length > 0 ? (
        <section className="space-y-3">
          <div className="px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Category Review</p>
            <p className="mt-1 text-sm text-slate-600">Uncertain merchants, split merchants, and anything that still needs a category decision.</p>
          </div>
          <div className="space-y-3">
            {categoryQueue.map((transaction) => (
              <CategoryCard
                key={transaction.id}
                suggestion={suggestionMap.get(transaction.id)}
                transaction={transaction}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DuplicateCard({
  transaction,
  pendingMatch,
}: {
  transaction: Transaction;
  pendingMatch: Transaction | null | undefined;
}) {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-rose-950">Possible duplicate</p>
            <p className="mt-1 text-sm text-rose-900/80">
              Same merchant and amount within 7 days. Decide whether this one is new or a duplicate.
            </p>
          </div>
          <Pill tone="warning">Dup check</Pill>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TransactionSummaryCard
          badge="This transaction"
          tone="current"
          transaction={transaction}
        />
        {pendingMatch ? (
          <TransactionSummaryCard
            badge="Matched transaction"
            tone="match"
            transaction={pendingMatch}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Matching transaction details are not available, but this item still matched the duplicate rule.
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <form action={resolvePendingTransactionAction}>
          <input type="hidden" name="transactionId" value={transaction.id} />
          <input type="hidden" name="resolution" value="mark_duplicate" />
          <input type="hidden" name="returnTo" value="/review" />
          <button className="w-full rounded-2xl bg-rose-900 px-4 py-3 text-sm font-semibold text-white">
            Mark duplicate
          </button>
        </form>
        <form action={resolvePendingTransactionAction}>
          <input type="hidden" name="transactionId" value={transaction.id} />
          <input type="hidden" name="resolution" value="confirm_new" />
          <input type="hidden" name="returnTo" value="/review" />
          <button className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-900">
            Keep as new
          </button>
        </form>
      </div>
    </Card>
  );
}

function CategoryCard({
  transaction,
  suggestion,
}: {
  transaction: Transaction;
  suggestion:
    | {
        transactionId: string;
        suggestedCategory: string;
        confidence: number;
        reason: string;
        shouldAutoApply: boolean;
      }
    | undefined;
}) {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      {suggestion ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">
                AI suggests {categories.find((category) => category.slug === suggestion.suggestedCategory)?.label ?? suggestion.suggestedCategory}
              </p>
              <p className="mt-1 text-sm text-amber-900/80">{suggestion.reason}</p>
            </div>
            <Pill tone="accent">{Math.round(suggestion.confidence * 100)}%</Pill>
          </div>
          <form action={applyAiSuggestionAction} className="mt-3">
            <input type="hidden" name="transactionId" value={transaction.id} />
            <input type="hidden" name="category" value={suggestion.suggestedCategory} />
            <input type="hidden" name="reason" value={`AI suggestion accepted. ${suggestion.reason}`} />
            <input type="hidden" name="returnTo" value="/review" />
            <button className="w-full rounded-2xl bg-amber-900 px-4 py-3 text-sm font-semibold text-white sm:w-auto">
              Accept AI suggestion
            </button>
          </form>
        </div>
      ) : null}

      <TransactionSummaryCard
        badge={transaction.finalCategory === "review" ? "Split merchant" : "Review"}
        tone="current"
        transaction={transaction}
      />

      <form action={updateTransactionCategoryAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="transactionId" value={transaction.id} />
        <input type="hidden" name="returnTo" value="/review" />
        <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" name="category" defaultValue={transaction.finalCategory}>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
        <button className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Assign</button>
      </form>

      <form action={resolvePendingTransactionAction}>
        <input type="hidden" name="transactionId" value={transaction.id} />
        <input type="hidden" name="resolution" value="mark_duplicate" />
        <input type="hidden" name="returnTo" value="/review" />
        <button className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
          Mark as duplicate
        </button>
      </form>

      <form action={addMerchantRuleAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="merchantPattern" value={transaction.merchantNormalized} />
        <input type="hidden" name="returnTo" value="/review" />
        <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" name="category" defaultValue={transaction.finalCategory}>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
        <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
          Save rule
        </button>
      </form>
    </Card>
  );
}

function TransactionSummaryCard({
  transaction,
  badge,
  tone,
}: {
  transaction: Transaction;
  badge: string;
  tone: "current" | "match";
}) {
  const badgeClassName =
    tone === "match"
      ? "bg-rose-100 text-rose-800"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${badgeClassName}`}>
              {badge}
            </span>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
              {format(new Date(transaction.date), "EEE d MMM yyyy")}
            </span>
          </div>
          <p className="text-base font-semibold leading-tight text-slate-950">{transaction.merchantRaw}</p>
        </div>
        <p className="shrink-0 text-lg font-semibold text-slate-950">{formatPreciseCurrency(transaction.amount)}</p>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Account</dt>
          <dd className="mt-1 text-slate-700">
            {transaction.sourceAccountName} · {transaction.sourceAccountType === "credit_card" ? "CC" : "Savings/Bank"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Category</dt>
          <dd className="mt-1 text-slate-700">{transaction.finalCategory}</dd>
        </div>
        {transaction.postedAt && transaction.postedAt !== transaction.date ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Posted</dt>
            <dd className="mt-1 text-slate-700">{format(new Date(transaction.postedAt), "EEE d MMM yyyy")}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
