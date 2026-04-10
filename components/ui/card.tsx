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
        "rounded-2xl border border-white/70 bg-white/90 p-3 shadow-[0_10px_28px_rgba(38,56,76,0.07)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}
