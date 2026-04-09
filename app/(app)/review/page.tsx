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
  const queue = snapshot.transactions.filter((transaction) => transaction.needsReview || duplicateMatchMap.has(transaction.id));
  const aiSuggestions = await getAiSuggestions(snapshot, queue.slice(0, 12));
  await persistAiSuggestions(aiSuggestions);
  const suggestionMap = new Map(aiSuggestions.map((suggestion) => [suggestion.transactionId, suggestion]));

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2 px-1">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Review Queue</p>
        <h1 className="text-4xl font-bold text-slate-950">Clean up the uncertain ones in minutes.</h1>
        <p className="text-sm text-slate-600">{queue.length} transactions need a decision.</p>
      </div>

      <StatusBanner status={status} />

      {queue.length === 0 ? (
        <Card>
          <p className="text-lg font-semibold text-slate-950">Queue clear</p>
          <p className="mt-2 text-sm text-slate-600">Everything currently has a confident category. Nice quiet moment.</p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {queue.map((transaction) => {
          const suggestion = suggestionMap.get(transaction.id);
          const duplicateMatchId = transaction.pendingMatchTransactionId ?? duplicateMatchMap.get(transaction.id) ?? null;
          const pendingMatch = duplicateMatchId ? transactionMap.get(duplicateMatchId) : null;
          const isDuplicateCandidate = transaction.pendingStatus === "matched" || duplicateMatchMap.has(transaction.id);

          return (
          <Card key={transaction.id} className="space-y-4">
            {isDuplicateCandidate && pendingMatch ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-rose-950">Possible duplicate</p>
                    <p className="mt-1 text-sm text-rose-900/80">
                      This looks like the same transaction as an existing row. Review it before you decide whether to keep it or mark it as a duplicate.
                    </p>
                    <p className="mt-2 text-xs text-rose-900/70">
                      Match: {pendingMatch.merchantRaw} · {format(new Date(pendingMatch.date), "EEE d MMM")} ·{" "}
                      {formatPreciseCurrency(pendingMatch.amount)}
                    </p>
                  </div>
                  <Pill tone="warning">Dup check</Pill>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <form action={resolvePendingTransactionAction}>
                    <input type="hidden" name="transactionId" value={transaction.id} />
                    <input type="hidden" name="resolution" value="mark_duplicate" />
                    <input type="hidden" name="returnTo" value="/review" />
                    <button className="w-full rounded-2xl bg-rose-900 px-4 py-2 text-sm font-semibold text-white">
                      Mark duplicate
                    </button>
                  </form>
                  <form action={resolvePendingTransactionAction}>
                    <input type="hidden" name="transactionId" value={transaction.id} />
                    <input type="hidden" name="resolution" value="confirm_new" />
                    <input type="hidden" name="returnTo" value="/review" />
                    <button className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-900">
                      Keep as new
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
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
                  <button className="rounded-2xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white">
                    Accept AI suggestion
                  </button>
                </form>
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {format(new Date(transaction.date), "EEE d MMM yyyy")}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-slate-950">{transaction.merchantRaw}</p>
                  <Pill tone="warning">{isDuplicateCandidate ? "Dup check" : transaction.finalCategory === "review" ? "Split merchant" : "Review"}</Pill>
                </div>
                {transaction.postedAt && transaction.postedAt !== transaction.date ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Posted {format(new Date(transaction.postedAt), "EEE d MMM yyyy")}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-slate-500">
                  {transaction.sourceAccountName} · {transaction.sourceAccountType === "credit_card" ? "CC" : "Savings/Bank"}
                </p>
              </div>
              <p className="text-lg font-semibold text-slate-950">{formatPreciseCurrency(transaction.amount)}</p>
            </div>

            <form action={updateTransactionCategoryAction} className="grid grid-cols-[1fr_auto] gap-2">
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

            {transaction.pendingStatus !== "matched" ? (
              <form action={resolvePendingTransactionAction}>
                <input type="hidden" name="transactionId" value={transaction.id} />
                <input type="hidden" name="resolution" value="mark_duplicate" />
                <input type="hidden" name="returnTo" value="/review" />
                <button className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                  Mark as duplicate
                </button>
              </form>
            ) : null}

            <form action={addMerchantRuleAction} className="grid grid-cols-[1fr_auto] gap-2">
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
        })}
      </div>
    </div>
  );
}
