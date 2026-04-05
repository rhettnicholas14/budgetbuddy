import { buildMerchantTrends, buildTrendSeries } from "@/lib/domain/selectors";
import { Card } from "@/components/ui/card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { formatCompactCurrency, formatCurrency } from "@/lib/domain/format";
import { getAppSnapshot } from "@/lib/app-data";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const snapshot = await getAppSnapshot();
  const params = await searchParams;
  const mode = params.mode === "calendar" ? "calendar" : "cycle";
  const trendSeries = buildTrendSeries(snapshot.transactions, mode, snapshot.household.cycleStartDay);
  const merchantTrends = buildMerchantTrends(snapshot.transactions, snapshot.household.cycleStartDay);

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2 px-1">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Trends</p>
        <h1 className="text-4xl font-bold text-slate-950">See what is drifting, not just what happened.</h1>
      </div>

      <Card>
        <form className="grid grid-cols-2 gap-2">
          <button
            name="mode"
            value="cycle"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${mode === "cycle" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Cycle month
          </button>
          <button
            name="mode"
            value="calendar"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${mode === "calendar" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Calendar month
          </button>
        </form>
      </Card>

      <Card>
        <TrendChart data={trendSeries} />
      </Card>

      <Card className="space-y-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Merchant changes</p>
          <p className="mt-1 text-sm text-slate-600">Biggest month-to-month movement in your controllable spend.</p>
        </div>
        {merchantTrends.map((trend) => (
          <div key={trend.merchant} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
            <div>
              <p className="font-semibold text-slate-900">{trend.merchant}</p>
              <p className="text-sm text-slate-500">
                {formatCompactCurrency(trend.previous)} to {formatCompactCurrency(trend.current)}
              </p>
            </div>
            <p className={`text-sm font-semibold ${trend.deltaDirection === "up" ? "text-rose-700" : trend.deltaDirection === "down" ? "text-emerald-700" : "text-slate-500"}`}>
              {trend.deltaDirection === "up" ? "+" : ""}
              {formatCurrency(trend.delta)}
            </p>
          </div>
        ))}
      </Card>
    </div>
  );
}
