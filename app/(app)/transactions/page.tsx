import { format } from "date-fns";
import { updateTransactionCategoryAction } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { StatusBanner } from "@/components/ui/status-banner";
import { CsvUpload } from "@/components/transactions/csv-upload";
import { categories } from "@/lib/domain/categories";
import { formatCurrency, formatPreciseCurrency } from "@/lib/domain/format";
import { getAppSnapshot } from "@/lib/app-data";
import { getCycleWindow } from "@/lib/domain/cycle";
import { buildAccountSummaries } from "@/lib/domain/selectors";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const snapshot = await getAppSnapshot();
  const params = await searchParams;
  const query = String(params.search ?? "").toLowerCase();
  const bucket = String(params.bucket ?? "");
  const account = String(params.account ?? "");
  const month = String(params.month ?? "");
  const period = String(params.period ?? "");
  const reviewOnly = params.review === "true";
  const status = String(params.status ?? "");
  const currentCycle = getCycleWindow(new Date(), snapshot.household.cycleStartDay).label;
  const accountSummaries = buildAccountSummaries(snapshot.accounts, snapshot.transactions, snapshot.household.cycleStartDay);
  const totalCreditCardBalance = accountSummaries
    .filter((summary) => summary.accountType === "credit_card")
    .reduce((sum, summary) => sum + summary.balance, 0);
  const totalCreditCardCycleSpend = accountSummaries
    .filter((summary) => summary.accountType === "credit_card")
    .reduce((sum, summary) => sum + summary.cycleSpend, 0);
  const creditCardCount = accountSummaries.filter((summary) => summary.accountType === "credit_card").length;
  const currentSearch = new URLSearchParams();

  if (query) currentSearch.set("search", query);
  if (bucket) currentSearch.set("bucket", bucket);
  if (reviewOnly) currentSearch.set("review", "true");
  if (period) currentSearch.set("period", period);
  if (account) currentSearch.set("account", account);
  if (month) currentSearch.set("month", month);

  const returnTo = currentSearch.toString() ? `/transactions?${currentSearch.toString()}` : "/transactions";

  const filtered = snapshot.transactions.filter((transaction) => {
    if (reviewOnly && !transaction.needsReview) {
      return false;
    }

    if (bucket && transaction.finalCategory !== bucket) {
      return false;
    }

    if (account && transaction.accountId !== account) {
      return false;
    }

    if (period === "cycle" && transaction.cycleLabel !== currentCycle) {
      return false;
    }

    if (month && !transaction.date.startsWith(month)) {
      return false;
    }

    if (query && !`${transaction.merchantRaw} ${transaction.descriptionRaw}`.toLowerCase().includes(query)) {
      return false;
    }

    return true;
  });

  const flattenedTransactions = [...filtered].sort((left, right) => {
    const rightPostedAt = right.postedAt || right.date;
    const leftPostedAt = left.postedAt || left.date;

    if (rightPostedAt !== leftPostedAt) {
      return rightPostedAt.localeCompare(leftPostedAt);
    }

    if (right.date !== left.date) {
      return right.date.localeCompare(left.date);
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
  const csvImportWatermarks = snapshot.transactions
    .filter((transaction) => transaction.provider === "csv")
    .reduce<Array<{ accountName: string; lastImportedDate: string }>>((accumulator, transaction) => {
      const existing = accumulator.find((entry) => entry.accountName === transaction.sourceAccountName);

      if (!existing) {
        accumulator.push({
          accountName: transaction.sourceAccountName,
          lastImportedDate: transaction.date,
        });
        return accumulator;
      }

      if (transaction.date > existing.lastImportedDate) {
        existing.lastImportedDate = transaction.date;
      }

      return accumulator;
    }, [])
    .sort((left, right) => left.accountName.localeCompare(right.accountName));

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2 px-1">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Transactions</p>
        <h1 className="text-4xl font-bold text-slate-950">One fast transaction view across every account.</h1>
      </div>

      <StatusBanner status={status} />

      {creditCardCount > 0 ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Credit Card Total</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{formatCurrency(totalCreditCardBalance)}</p>
              <p className="mt-1 text-sm text-slate-600">
                Across {creditCardCount} credit card{creditCardCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
              <p className="text-xs text-slate-500">Cycle spend</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(totalCreditCardCycleSpend)}</p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {accountSummaries.map((summary) => (
          <Card
            key={summary.accountId}
            className={account === summary.accountId ? "border-slate-900/20 bg-slate-50" : ""}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-950">{summary.accountName}</p>
                <p className="text-sm text-slate-500">
                  {summary.institutionName} · {summary.accountType === "credit_card" ? "Credit card" : summary.accountType}
                </p>
              </div>
              <p className="text-lg font-semibold text-slate-950">{formatCurrency(summary.balance)}</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-white px-3 py-2">
                <p className="text-slate-500">Cycle spend</p>
                <p className="mt-1 font-semibold text-slate-900">{formatCurrency(summary.cycleSpend)}</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2">
                <p className="text-slate-500">Transactions</p>
                <p className="mt-1 font-semibold text-slate-900">{summary.transactionCount}</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2">
                <p className="text-slate-500">Review</p>
                <p className="mt-1 font-semibold text-slate-900">{summary.reviewCount}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Latest transaction {summary.lastTransactionDate ? format(new Date(summary.lastTransactionDate), "EEE d MMM yyyy") : "not available"}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <form className="grid grid-cols-2 gap-3">
          <input
            className="col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            name="search"
            placeholder="Search merchants"
            defaultValue={query}
          />
          <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" name="bucket" defaultValue={bucket}>
            <option value="">All buckets</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
          <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" name="review" defaultValue={String(params.review ?? "")}>
            <option value="">All statuses</option>
            <option value="true">Review needed</option>
          </select>
          <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" name="period" defaultValue={period}>
            <option value="">All periods</option>
            <option value="cycle">Current cycle</option>
          </select>
          <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" name="account" defaultValue={account}>
            <option value="">All accounts</option>
            {snapshot.accounts.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.sourceAccountName}
              </option>
            ))}
          </select>
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
          <button className="col-span-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Apply filters</button>
        </form>
      </Card>

      <Card>
        <CsvUpload watermarks={csvImportWatermarks} />
      </Card>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full table-fixed border-collapse text-[10px]">
          <colgroup>
            <col style={{ width: "58px" }} />
            <col style={{ width: "74px" }} />
            <col style={{ width: "calc(100% - 58px - 74px - 94px - 132px)" }} />
            <col style={{ width: "94px" }} />
            <col style={{ width: "132px" }} />
          </colgroup>
          <thead className="bg-slate-50 text-left text-[10px] text-slate-500">
            <tr>
              <th className="px-2 py-2 font-semibold">Date</th>
              <th className="px-2 py-2 font-semibold">Account</th>
              <th className="px-2 py-2 font-semibold">Merchant</th>
              <th className="px-2 py-2 font-semibold">Amount</th>
              <th className="px-2 py-2 font-semibold">Category</th>
            </tr>
          </thead>
          <tbody>
            {flattenedTransactions.map((transaction) => (
              <tr key={transaction.id} className="border-t border-slate-100 align-top">
                <td className="px-2 py-2 text-slate-600">
                  <div className="whitespace-nowrap font-semibold text-slate-900">{format(new Date(transaction.date), "d MMM")}</div>
                  {transaction.postedAt && transaction.postedAt !== transaction.date ? (
                    <div className="mt-0.5 whitespace-nowrap text-[9px] text-slate-500">
                      {format(new Date(transaction.postedAt), "d MMM")}
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <div className="truncate font-semibold text-slate-900">{transaction.sourceAccountName}</div>
                  <div className="mt-0.5 text-[9px] text-slate-500">
                    {transaction.sourceAccountType === "credit_card" ? "CC" : "Bank"}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="truncate text-[10px] font-semibold text-slate-950">{transaction.merchantNormalized}</div>
                  <div className="mt-0.5 truncate text-[9px] text-slate-500">{transaction.descriptionRaw}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-semibold ${
                        transaction.direction === "credit"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {transaction.direction === "credit" ? "In" : "Out"}
                    </span>
                    {transaction.overrideCategory ? (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
                        Manual
                      </span>
                    ) : null}
                    {transaction.pendingStatus === "matched" ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                        Pending
                      </span>
                    ) : null}
                  </div>
                </td>
                <td
                  className={`px-2 py-2 whitespace-nowrap text-right font-semibold ${
                    transaction.direction === "credit" ? "text-emerald-700" : "text-slate-950"
                  }`}
                >
                  {transaction.direction === "credit" ? "+" : "-"}
                  {formatPreciseCurrency(Math.abs(transaction.amount))}
                </td>
                <td className="px-2 py-2">
                  <form action={updateTransactionCategoryAction} className="space-y-1">
                    <input type="hidden" name="transactionId" value={transaction.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px]"
                      name="category"
                      defaultValue={transaction.finalCategory}
                    >
                      {categories.map((category) => (
                        <option key={category.slug} value={category.slug}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <button className="w-full rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-semibold text-white">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
