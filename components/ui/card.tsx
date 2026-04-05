import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={style}
      className={cn(
        "rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_60px_rgba(38,56,76,0.08)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}
