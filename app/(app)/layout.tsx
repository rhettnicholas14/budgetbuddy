import type { ReactNode } from "react";
import { BottomNavShell } from "@/components/ui/bottom-nav-shell";
import { DesktopNav } from "@/components/ui/desktop-nav";
import { appEnv } from "@/lib/env";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
      <DesktopNav />
      <main className="flex-1 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
        {appEnv.mockMode ? (
          <div className="mb-4 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">
            Demo mode active. Supabase and Basiq can be connected later without changing the UI flow.
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      <BottomNavShell />
    </div>
  );
}
