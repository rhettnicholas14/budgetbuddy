import { buildWeeklyTrackerSummary } from "@/lib/domain/selectors";
import { getAppSnapshot } from "@/lib/app-data";
import { formatCompactCurrency, formatCurrency, formatPercent, formatPreciseCurrency } from "@/lib/domain/format";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SectionHeading } from "@/components/ui/section-heading";
import { WeeklyTrendChart } from "@/components/weekly/weekly-trend-chart";

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const snapshot = await getAppSnapshot();
  const params = await searchParams;
  const mode = params.mode === "cycle" ? "cycle" : "calendar";
  const weekly = buildWeeklyTrackerSummary(snapshot.transactions, mode, snapshot.household.cycleStartDay);

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2 px-1">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Weekly Tracker</p>
        <h1 className="text-4xl font-bold text-slate-950">Manage the week before the month gets away.</h1>
        <p className="text-sm text-slate-600">Main control metric is Groceries + Lifestyle against a weekly target of {formatCurrency(weekly.target)}.</p>
      </div>

      <Card>
        <form className="grid grid-cols-2 gap-2">
          <button
            name="mode"
            value="calendar"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${mode === "calendar" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Calendar week
          </button>
          <button
            name="mode"
            value="cycle"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${mode === "cycle" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Cycle week
          </button>
        </form>
      </Card>

      <Card className="overflow-hidden bg-[linear-gradient(135deg,#17324a_0%,#244855_42%,#ef7d57_100%)] text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">Groceries + Lifestyle</p>
            <p className="mt-1 text-sm text-white/80">{weekly.label}</p>
          </div>
          <span className={statusClassNames[weekly.status.tone]}>{weekly.status.label}</span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-5xl font-bold">{formatCurrency(weekly.controlSpend)}</p>
            <p className="mt-2 text-sm text-white/75">Target {formatCurrency(weekly.target)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Remaining</p>
            <p className="mt-1 text-lg font-semibold">
              {weekly.remaining >= 0 ? formatCurrency(weekly.remaining) : `Over ${formatCurrency(Math.abs(weekly.remaining))}`}
            </p>
          </div>
        </div>
        <ProgressBar className="mt-4 bg-white/10" tone="bg-white" value={weekly.controlSpend / weekly.target} />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <MetricBox label="Previous week" value={formatCurrency(weekly.previousWeekControlSpend)} />
          <MetricBox
            label="Delta"
            value={`${weekly.previousWeekDelta > 0 ? "+" : weekly.previousWeekDelta < 0 ? "-" : ""}${formatCurrency(Math.abs(weekly.previousWeekDelta))}`}
            helper={
              weekly.previousWeekDeltaPercent == null
                ? "No prior baseline"
                : `${weekly.previousWeekDeltaPercent > 0 ? "+" : ""}${formatPercent(weekly.previousWeekDeltaPercent)} vs previous week`
            }
          />
        </div>
      </Card>

      <Card>
        <SectionHeading title="Weekly breakdown" subtitle="Context around the control metric for this week" />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <MetricTile label="Groceries" value={formatCurrency(weekly.groceries)} />
          <MetricTile label="Lifestyle" value={formatCurrency(weekly.lifestyle)} />
          <MetricTile label="Essential Variable" value={formatCurrency(weekly.essentialVariable)} />
          <MetricTile label="Fixed CC" value={formatCurrency(weekly.fixedCC)} />
          <MetricTile label="Total spend" value={formatCurrency(weekly.totalSpend)} />
          <MetricTile
            label="Vs recent average"
            value={
              weekly.vsAverageDirection === "flat"
                ? "Flat"
                : weekly.vsAverageDirection === "above"
                  ? "Above"
                  : "Below"
            }
            helper={formatCurrency(weekly.recentAverageControlSpend)}
          />
        </div>
      </Card>

      <Card>
        <SectionHeading title="Last 8 weeks" subtitle="Bars show weekly buckets, line shows Groceries + Lifestyle" />
        <div className="mt-4">
          <WeeklyTrendChart data={weekly.history} />
        </div>
      </Card>

      <Card>
        <SectionHeading title="Weekly averages" subtitle="Use these to spot drift before it becomes a monthly problem" />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <MetricTile label="Average Groceries" value={formatCurrency(weekly.averageWeeklyGroceries)} />
          <MetricTile label="Average Lifestyle" value={formatCurrency(weekly.averageWeeklyLifestyle)} />
          <MetricTile
            label="Highest lifestyle week"
            value={weekly.highestLifestyleWeek ? formatCurrency(weekly.highestLifestyleWeek.lifestyle) : formatCurrency(0)}
            helper={weekly.highestLifestyleWeek?.label ?? "No history"}
          />
          <MetricTile label="Recent control avg" value={formatCurrency(weekly.recentAverageControlSpend)} />
        </div>
      </Card>

      <Card className="space-y-3">
        <SectionHeading title="This week’s transactions" subtitle="The rows currently driving the weekly tracker" />
        {weekly.recentTransactions.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">No tracked spending in this week yet.</div>
        ) : null}
        {weekly.recentTransactions.map((transaction) => (
          <div key={transaction.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{transaction.merchantNormalized}</p>
              <p className="mt-1 text-sm text-slate-500">
                {new Date(transaction.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} · {transaction.finalCategory.replaceAll("_", " ")}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500">{transaction.sourceAccountName}</p>
            </div>
            <p className="whitespace-nowrap text-sm font-semibold text-slate-950">
              {transaction.direction === "credit" ? "+" : "-"}
              {formatPreciseCurrency(Math.abs(transaction.amount))}
            </p>
          </div>
        ))}
      </Card>
    </div>
  );
}

function MetricTile({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function MetricBox({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-white/65">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-xs text-white/70">{helper}</p> : null}
    </div>
  );
}

const statusClassNames = {
  green: "inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900",
  amber: "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900",
  red: "inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800",
};
