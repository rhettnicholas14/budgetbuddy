import Link from "next/link";
import { getAppSnapshot } from "@/lib/app-data";
import { getDashboardInsights } from "@/lib/ai/finance-assistant";
import { buildBudgetSummary, buildTrendSeries, buildWeeklyTrackerSummary } from "@/lib/domain/selectors";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/domain/format";
import { getCycleWindow } from "@/lib/domain/cycle";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { WeeklySparkline } from "@/components/weekly/weekly-trend-chart";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SectionHeading } from "@/components/ui/section-heading";

export default async function DashboardPage() {
  const snapshot = await getAppSnapshot();
  const summary = buildBudgetSummary(snapshot.transactions, snapshot.budget, snapshot.household.cycleStartDay);
  const weekly = buildWeeklyTrackerSummary(snapshot.transactions, "calendar", snapshot.household.cycleStartDay);
  const cycle = getCycleWindow(new Date(), snapshot.household.cycleStartDay);
  const trends = buildTrendSeries(snapshot.transactions, "cycle", snapshot.household.cycleStartDay);
  const insights = await getDashboardInsights(snapshot);

  const categoryCards = [
    { label: "Fixed", value: summary.fixedSpend, target: snapshot.budget.fixedTarget, tone: "bg-[#244855]" },
    { label: "Groceries", value: summary.groceriesSpend, target: snapshot.budget.groceriesTarget, tone: "bg-[#4e7f52]" },
    { label: "Essential", value: summary.essentialVariableSpend, target: snapshot.budget.essentialVariableTarget, tone: "bg-[#6d8d9e]" },
    { label: "Lifestyle", value: summary.lifestyleSpend, target: snapshot.budget.lifestyleTarget, tone: "bg-[#ef7d57]" },
    { label: "One-Offs", value: summary.oneOffSpend, target: snapshot.budget.oneOffTarget, tone: "bg-[#cc5b5b]" },
  ];
  const cycleBudgetCopy =
    summary.remainingBudget >= 0
      ? `Remaining ${formatCurrency(summary.remainingBudget)} of ${formatCurrency(snapshot.budget.cycleTarget)}`
      : `Over budget by ${formatCurrency(Math.abs(summary.remainingBudget))}`;

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2 px-1">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Dashboard</p>
        <h1 className="text-4xl font-bold text-slate-950">What matters this cycle</h1>
        <p className="text-sm text-slate-600">
          Cycle {cycle.label}. {cycle.daysElapsed} of {cycle.totalDays} days elapsed.
        </p>
      </div>

      <Card
        className="overflow-hidden text-white"
        style={{ backgroundImage: "linear-gradient(135deg, #274636 0%, #355e3b 44%, #ef7d57 100%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">Weekly Tracker</p>
            <p className="mt-1 text-sm text-white/80">Groceries + Lifestyle · {weekly.label}</p>
          </div>
          <span className={weeklyStatusClasses[weekly.status.tone]}>{weekly.status.label}</span>
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
        <div className="mt-4">
          <WeeklySparkline data={weekly.history} />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-[11px]">
          <BreakdownChip label="Groceries" value={weekly.groceries} />
          <BreakdownChip label="Lifestyle" value={weekly.lifestyle} />
          <BreakdownChip label="Essential" value={weekly.essentialVariable} />
          <BreakdownChip label="Fixed" value={weekly.fixedCC} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <p className="text-white/80">
            {weekly.previousWeekDelta === 0
              ? "Flat vs previous week"
              : `${weekly.previousWeekDelta > 0 ? "+" : "-"}${formatCurrency(Math.abs(weekly.previousWeekDelta))} vs previous week`}
          </p>
          <Link href="/weekly" className="rounded-full bg-white/15 px-3 py-1.5 font-semibold text-white">
            Open
          </Link>
        </div>
      </Card>

      <Card
        className="overflow-hidden text-white"
        style={{ backgroundImage: "linear-gradient(135deg, #132437 0%, #24384e 38%, #ef7d57 100%)" }}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">Budget-tracked cycle spend</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-5xl font-bold">{formatCurrency(summary.budgetTrackedSpend)}</p>
            <p className="mt-2 text-sm text-white/75">{cycleBudgetCopy}</p>
          </div>
          <Pill tone={summary.paceStatus === "over_pace" ? "warning" : "accent"}>
            {summary.paceStatus === "over_pace" ? "Over pace" : "On track"}
          </Pill>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-white/70">Mortgage</p>
            <p className="mt-1 text-xl font-semibold">{formatCompactCurrency(summary.mortgageSpend)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-white/70">Review queue</p>
            <p className="mt-1 text-xl font-semibold">{summary.uncategorizedCount}</p>
          </div>
        </div>
      </Card>

      <Card className="border-[#ef7d57]/20 bg-[#fff8f5]">
        <SectionHeading title="Lifestyle" subtitle="Your main control lever for the cycle" />
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-4xl font-bold text-slate-950">{formatCurrency(summary.lifestyleSpend)}</p>
            <p className="mt-1 text-sm text-slate-600">{formatPercent(summary.lifestyleSpend / snapshot.budget.lifestyleTarget)} of {formatCurrency(snapshot.budget.lifestyleTarget)} target</p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Remaining</p>
            <p className="text-lg font-semibold text-[#ef7d57]">{formatCurrency(snapshot.budget.lifestyleTarget - summary.lifestyleSpend)}</p>
          </div>
        </div>
        <ProgressBar className="mt-4" tone="bg-[#ef7d57]" value={summary.lifestyleSpend / snapshot.budget.lifestyleTarget} />
      </Card>

      <Card>
        <SectionHeading title="Cycle buckets" subtitle="Progress against the shared budget plan" />
        <div className="mt-4 space-y-4">
          {categoryCards.map((card) => (
            <div key={card.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold text-slate-800">{card.label}</p>
                <p className="text-slate-600">
                  {formatCurrency(card.value)} / {formatCurrency(card.target)}
                </p>
              </div>
              <ProgressBar tone={card.tone} value={card.value / Math.max(card.target, 1)} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeading title="Budget views" subtitle="Track raw spend and operating spend separately" />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <MetricTile label="Operating spend" value={formatCompactCurrency(summary.operatingSpend)} />
          <MetricTile label="Budget-tracked spend" value={formatCompactCurrency(summary.budgetTrackedSpend)} />
          <MetricTile label="Excluding transfers" value={formatCompactCurrency(summary.transferExcludedSpend)} />
          <MetricTile label="Excluding reimbursements" value={formatCompactCurrency(summary.reimbursementExcludedSpend)} />
          <MetricTile label="Mortgage" value={formatCompactCurrency(summary.mortgageSpend)} />
        </div>
      </Card>

      <Card>
        <SectionHeading title="Cycle trend" subtitle="Last six cycle windows" />
        <div className="mt-4">
          <TrendChart data={trends} />
        </div>
      </Card>

      <Card>
        <SectionHeading title="AI Insights" subtitle="Short practical guidance for this week" />
        <div className="mt-4 space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.title}
              className={`rounded-2xl p-4 ${
                insight.tone === "warning"
                  ? "bg-rose-50"
                  : insight.tone === "positive"
                    ? "bg-emerald-50"
                    : "bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold text-slate-950">{insight.title}</p>
              <p className="mt-1 text-sm text-slate-600">{insight.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function BreakdownChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/12 px-2 py-2">
      <p className="text-white/65">{label}</p>
      <p className="mt-1 font-semibold text-white">{formatCurrency(value)}</p>
    </div>
  );
}

const weeklyStatusClasses = {
  green: "inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900",
  amber: "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900",
  red: "inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800",
};
