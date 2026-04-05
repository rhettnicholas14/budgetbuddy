import { cn } from "@/lib/utils/cn";

export function ProgressBar({
  value,
  className,
  tone = "bg-slate-900",
}: {
  value: number;
  className?: string;
  tone?: string;
}) {
  return (
    <div className={cn("h-2.5 rounded-full bg-slate-200/80", className)}>
      <div
        className={cn("h-full rounded-full transition-all", tone)}
        style={{ width: `${Math.min(value * 100, 100)}%` }}
      />
    </div>
  );
}
