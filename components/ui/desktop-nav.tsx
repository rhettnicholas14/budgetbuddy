"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard", label: "Home" },
  { href: "/weekly", label: "Weekly" },
  { href: "/transactions", label: "Transactions" },
  { href: "/review", label: "Review" },
  { href: "/trends", label: "Trends" },
  { href: "/settings", label: "Settings" },
];

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 hidden border-b border-white/70 bg-[rgba(246,241,235,0.9)] backdrop-blur sm:block">
      <div className="mx-auto w-full max-w-5xl px-6 py-2 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2">
          {items.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
