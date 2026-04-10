import {
  addMerchantRuleAction,
  deleteMerchantRuleAction,
  reapplyMerchantRulesAction,
  updateBudgetLeversAction,
  updateMerchantRuleAction,
} from "@/app/actions";
import { Card } from "@/components/ui/card";
import { ConnectBankButton } from "@/components/settings/connect-bank-button";
import { DemoResetButton } from "@/components/settings/demo-reset-button";
import { StatusBanner } from "@/components/ui/status-banner";
import { categories } from "@/lib/domain/categories";
import { formatCurrency } from "@/lib/domain/format";
import { buildAccountSummaries, buildBudgetSummary } from "@/lib/domain/selectors";
import { getAppSnapshot } from "@/lib/app-data";
import { appEnv } from "@/lib/env";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const snapshot = await getAppSnapshot();
  const params = await searchParams;
  const basiqStatus = String(params.basiq ?? "");
  const status = String(params.status ?? "");
  const ruleSearch = String(params.ruleSearch ?? "").trim().toLowerCase();
  const ruleCategory = String(params.ruleCategory ?? "").trim();
  const liveConnection = snapshot.bankConnections.find((entry) => entry.provider === "basiq");
  const accountSummaries = buildAccountSummaries(snapshot.accounts, snapshot.transactions, snapshot.household.cycleStartDay);
  const budgetSummary = buildBudgetSummary(snapshot.transactions, snapshot.budget, snapshot.household.cycleStartDay);
  const leverRows = [
    {
      id: "fixed",
      label: "Fixed",
      spend: budgetSummary.fixedSpend,
      target: snapshot.budget.fixedTarget,
      input: "fixedTarget",
      toggle: "fixedEnabled",
      note: "Subscriptions, insurance, regular bills",
    },
    {
      id: "groceries",
      label: "Groceries",
      spend: budgetSummary.groceriesSpend,
      target: snapshot.budget.groceriesTarget,
      input: "groceriesTarget",
      toggle: "groceriesEnabled",
      note: "Supermarket + household consumables",
    },
    {
      id: "essential",
      label: "Essential variable",
      spend: budgetSummary.essentialVariableSpend,
      target: snapshot.budget.essentialVariableTarget,
      input: "essentialVariableTarget",
      toggle: "essentialEnabled",
      note: "Medical, transport, required misc spend",
    },
    {
      id: "lifestyle",
      label: "Lifestyle",
      spend: budgetSummary.lifestyleSpend,
      target: snapshot.budget.lifestyleTarget,
      input: "lifestyleTarget",
      toggle: "lifestyleEnabled",
      note: "Main lever for faster cash-positive change",
    },
    {
      id: "oneoff",
      label: "One-offs",
      spend: budgetSummary.oneOffSpend,
      target: snapshot.budget.oneOffTarget,
      input: "oneOffTarget",
      toggle: "oneOffEnabled",
      note: "Non-recurring purchases and projects",
    },
  ] as const;
  const filteredRules = snapshot.merchantRules
    .filter((rule) => {
      if (!ruleSearch) {
        return ruleCategory ? rule.category === ruleCategory : true;
      }

      const matchesSearch = `${rule.normalizedMerchant} ${rule.merchantPattern}`.toLowerCase().includes(ruleSearch);
      const matchesCategory = ruleCategory ? rule.category === ruleCategory : true;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }

      return a.normalizedMerchant.localeCompare(b.normalizedMerchant);
    });

  const currentSearch = new URLSearchParams();

  if (ruleSearch) {
    currentSearch.set("ruleSearch", ruleSearch);
  }
  if (ruleCategory) {
    currentSearch.set("ruleCategory", ruleCategory);
  }

  const settingsReturnTo = currentSearch.toString() ? `/settings?${currentSearch.toString()}` : "/settings";

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2 px-1">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Settings & Mappings</p>
        <h1 className="text-4xl font-bold text-slate-950">Rules, connections, and household defaults.</h1>
      </div>

      <StatusBanner status={status} />

      <Card className="space-y-4">
        <div>
          <p className="text-lg font-semibold text-slate-950">Bank feeds</p>
          <p className="mt-1 text-sm text-slate-600">Connect NAB and Macquarie via Basiq, or run in mock mode locally.</p>
        </div>
        {liveConnection ? (
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {liveConnection.status === "active" ? "Basiq connected" : "Basiq connection pending"}
            </p>
            <p className="mt-1">
              Household Basiq user: {liveConnection.basiqUserId}
              {liveConnection.institutionName ? ` · ${liveConnection.institutionName}` : ""}
            </p>
            {liveConnection.lastSyncedAt ? (
              <p className="mt-1 text-slate-500">Last synced: {new Date(liveConnection.lastSyncedAt).toLocaleString("en-AU")}</p>
            ) : null}
          </div>
        ) : null}
        {basiqStatus ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {basiqStatus === "connected"
              ? "Basiq returned successfully. Run sync to import the connected accounts and transactions."
              : `Basiq status: ${basiqStatus}`}
          </div>
        ) : null}
        <ConnectBankButton />
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="text-lg font-semibold text-slate-950">Budget levers</p>
          <p className="mt-1 text-sm text-slate-600">Toggle each lever and set targets using current-cycle evidence.</p>
        </div>
        <form action={updateBudgetLeversAction} className="space-y-3">
          <input type="hidden" name="returnTo" value={settingsReturnTo} />
          {leverRows.map((lever) => {
            const variance = Number((lever.spend - lever.target).toFixed(2));
            const overTarget = lever.target > 0 && variance > 0;
            const withinTarget = lever.target > 0 && variance <= 0;

            return (
              <div key={lever.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <input type="checkbox" name={lever.toggle} defaultChecked={lever.target > 0} className="size-4 rounded border-slate-300" />
                    {lever.label}
                  </label>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      overTarget ? "bg-rose-100 text-rose-700" : withinTarget ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {lever.target > 0 ? (overTarget ? `${formatCurrency(variance)} over` : `${formatCurrency(Math.abs(variance))} under`) : "Disabled"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{lever.note}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                    <p className="text-xs text-slate-500">Actual</p>
                    <p className="font-semibold text-slate-900">{formatCurrency(lever.spend)}</p>
                  </div>
                  <label className="rounded-xl bg-slate-50 px-2.5 py-2">
                    <span className="block text-xs text-slate-500">Target</span>
                    <input
                      name={lever.input}
                      type="number"
                      step="1"
                      min="0"
                      defaultValue={Math.max(lever.target, 0)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900"
                    />
                  </label>
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <p className="text-slate-500">Current cycle tracked spend</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(budgetSummary.budgetTrackedSpend)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <p className="text-slate-500">Current cycle target</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(snapshot.budget.cycleTarget)}</p>
            </div>
          </div>
          <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
            Save budget levers
          </button>
        </form>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="text-lg font-semibold text-slate-950">Add merchant rule</p>
          <p className="mt-1 text-sm text-slate-600">Exact match wins first. Use split-merchant review for Amazon and Apple style merchants.</p>
        </div>
        <form action={addMerchantRuleAction} className="space-y-3">
          <input type="hidden" name="returnTo" value={settingsReturnTo} />
          <input
            name="merchantPattern"
            placeholder="Merchant name"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            required
          />
          <select name="category" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" defaultValue="review">
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="splitMerchant" className="size-4 rounded border-slate-300" />
            Treat as split merchant
          </label>
          <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
            Save rule
          </button>
        </form>
        <form action={reapplyMerchantRulesAction}>
          <input type="hidden" name="returnTo" value={settingsReturnTo} />
          <button className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
            Reapply rules to existing transactions
          </button>
        </form>
      </Card>

      <Card className="space-y-3">
        <div className="space-y-2">
          <div>
            <p className="text-lg font-semibold text-slate-950">Merchant mappings</p>
            <p className="mt-1 text-sm text-slate-600">Search, edit, deactivate, or delete rules inline.</p>
          </div>
          <form className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px_auto]">
            <input
              name="ruleSearch"
              placeholder="Search merchant rules"
              defaultValue={ruleSearch}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            />
            <select
              name="ruleCategory"
              defaultValue={ruleCategory}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
            <button className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800">
              Filter
            </button>
          </form>
        </div>
        {filteredRules.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">No rules match that search yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[640px] w-full border-collapse bg-white text-xs">
              <thead className="bg-slate-50 text-left text-[11px] text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-semibold">Merchant</th>
                  <th className="px-2 py-2 font-semibold">Category</th>
                  <th className="px-2 py-2 font-semibold">Split</th>
                  <th className="px-2 py-2 font-semibold">Active</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className={rule.active ? "border-t border-slate-100" : "border-t border-slate-100 bg-slate-50/80"}>
                    <td className="px-2 py-2 align-top">
                      <form action={updateMerchantRuleAction} className="contents">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <input type="hidden" name="returnTo" value={settingsReturnTo} />
                        <input
                          name="merchantPattern"
                          defaultValue={rule.merchantPattern}
                          className="w-full min-w-[150px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-900"
                          required
                        />
                      </form>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <form action={updateMerchantRuleAction} className="contents">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <input type="hidden" name="merchantPattern" value={rule.merchantPattern} />
                        <input type="hidden" name="returnTo" value={settingsReturnTo} />
                        <select name="category" defaultValue={rule.category} className="w-full min-w-[130px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px]">
                          {categories.map((category) => (
                            <option key={category.slug} value={category.slug}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </form>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <form action={updateMerchantRuleAction} className="contents">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <input type="hidden" name="merchantPattern" value={rule.merchantPattern} />
                        <input type="hidden" name="category" value={rule.category} />
                        <input type="hidden" name="active" value={rule.active ? "on" : ""} />
                        <input type="hidden" name="returnTo" value={settingsReturnTo} />
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                          <input type="checkbox" name="splitMerchant" defaultChecked={rule.splitMerchant} className="size-4 rounded border-slate-300" />
                          Yes
                        </label>
                      </form>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <form action={updateMerchantRuleAction} className="contents">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <input type="hidden" name="merchantPattern" value={rule.merchantPattern} />
                        <input type="hidden" name="category" value={rule.category} />
                        {rule.splitMerchant ? <input type="hidden" name="splitMerchant" value="on" /> : null}
                        <input type="hidden" name="returnTo" value={settingsReturnTo} />
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                          <input type="checkbox" name="active" defaultChecked={rule.active} className="size-4 rounded border-slate-300" />
                          Live
                        </label>
                      </form>
                    </td>
                    <td className="px-2 py-2 align-top text-[11px] text-slate-600">
                      {rule.matchType === "exact" ? "Exact" : "Contains"}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        <form action={updateMerchantRuleAction}>
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <input type="hidden" name="merchantPattern" value={rule.merchantPattern} />
                          <input type="hidden" name="category" value={rule.category} />
                          <input type="hidden" name="returnTo" value={settingsReturnTo} />
                          {rule.splitMerchant ? <input type="hidden" name="splitMerchant" value="on" /> : null}
                          {rule.active ? <input type="hidden" name="active" value="on" /> : null}
                          <button className="rounded-xl bg-slate-900 px-2.5 py-2 text-[11px] font-semibold text-white">Save</button>
                        </form>
                        <form action={deleteMerchantRuleAction}>
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <input type="hidden" name="returnTo" value={settingsReturnTo} />
                          <button className="text-[11px] font-semibold text-rose-700">Delete</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <p className="text-lg font-semibold text-slate-950">Accounts</p>
        <div className="space-y-2">
          {accountSummaries.map((summary) => (
            <div key={summary.accountId} className="rounded-2xl bg-slate-50 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{summary.accountName}</p>
                  <p className="text-sm text-slate-500">
                    {summary.institutionName} · {summary.accountType === "credit_card" ? "Credit card" : summary.accountType}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(summary.balance)}</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-2xl bg-white px-3 py-2">
                  <p className="text-slate-500">Cycle spend</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatCurrency(summary.cycleSpend)}</p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2">
                  <p className="text-slate-500">Rows</p>
                  <p className="mt-1 font-semibold text-slate-900">{summary.transactionCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2">
                  <p className="text-slate-500">Needs review</p>
                  <p className="mt-1 font-semibold text-slate-900">{summary.reviewCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-lg font-semibold text-slate-950">Household</p>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-500">Mode</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{appEnv.mockMode ? "Demo" : "Live"}</p>
        </div>
      </Card>

      {appEnv.mockMode ? (
        <Card className="space-y-3">
          <p className="text-lg font-semibold text-slate-950">Demo tools</p>
          <DemoResetButton />
        </Card>
      ) : null}
    </div>
  );
}
