import type { ReactNode } from "react";
import { BottomNavShell } from "@/components/ui/bottom-nav-shell";
import { appEnv } from "@/lib/env";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-6 pt-4">
        {appEnv.mockMode ? (
          <div className="mb-4 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">
            Demo mode active. Supabase and Basiq can be connected later without changing the UI flow.
          </div>
        ) : null}
        {children}
      </main>
      <BottomNavShell />
    </div>
  );
}
