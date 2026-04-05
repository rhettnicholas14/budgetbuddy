"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/domain/types";
import { formatCompactCurrency } from "@/lib/domain/format";

const series = [
  { key: "fixed_cc", color: "#244855" },
  { key: "groceries", color: "#4e7f52" },
  { key: "essential_variable", color: "#6d8d9e" },
  { key: "lifestyle", color: "#ef7d57" },
  { key: "one_off", color: "#cc5b5b" },
] as const;

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

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
          <Tooltip formatter={(value) => formatCompactCurrency(Number(value ?? 0))} />
          {series.map((entry) => (
            <Bar key={entry.key} dataKey={entry.key} stackId="spend" fill={entry.color} radius={entry.key === "one_off" ? [8, 8, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
