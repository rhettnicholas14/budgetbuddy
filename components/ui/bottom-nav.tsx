"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarRange, Home, ListFilter, SearchCheck, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/weekly", label: "Weekly", icon: CalendarRange },
  { href: "/transactions", label: "Transactions", icon: ListFilter },
  { href: "/review", label: "Review", icon: SearchCheck },
  { href: "/trends", label: "Trends", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-[rgba(246,241,235,0.96)] px-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 backdrop-blur-xl">
      <div className="mx-auto max-w-md">
        <div className="flex items-stretch gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 text-center text-[9px] font-medium leading-none transition sm:px-2 sm:text-[11px]",
                  active ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15" : "text-slate-500",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="block max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
