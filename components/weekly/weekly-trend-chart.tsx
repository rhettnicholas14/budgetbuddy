"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/domain/format";
import type { WeeklyTrackerPoint } from "@/lib/domain/types";

export function WeeklyTrendChart({ data }: { data: WeeklyTrackerPoint[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return <div className="h-72 w-full rounded-2xl bg-slate-50" />;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#e6e2dc" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) => [formatCurrency(Number(value ?? 0)), labelMap[String(name)] ?? String(name)]}
          />
          <Bar dataKey="groceries" stackId="weekly" fill="#4e7f52" />
          <Bar dataKey="lifestyle" stackId="weekly" fill="#ef7d57" />
          <Bar dataKey="essentialVariable" stackId="weekly" fill="#6d8d9e" />
          <Bar dataKey="fixedCC" stackId="weekly" fill="#244855" radius={[8, 8, 0, 0]} />
          <Line type="monotone" dataKey="controlSpend" stroke="#132437" strokeWidth={2} dot={{ r: 2 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklySparkline({ data }: { data: WeeklyTrackerPoint[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return <div className="h-12 w-full rounded-xl bg-white/10" />;
  }

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <Bar dataKey="controlSpend" fill="rgba(255,255,255,0.7)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const labelMap: Record<string, string> = {
  groceries: "Groceries",
  lifestyle: "Lifestyle",
  essentialVariable: "Essential",
  fixedCC: "Fixed CC",
  controlSpend: "Groceries + Lifestyle",
};
