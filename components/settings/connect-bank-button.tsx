"use client";

import { useState, useTransition } from "react";

export function ConnectBankButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="w-full rounded-2xl bg-[#ef7d57] px-4 py-3 text-sm font-semibold text-white"
        onClick={() =>
          startTransition(async () => {
            const response = await fetch("/api/basiq/connect", { method: "POST" });
            const payload = await response.json();

            if (payload.url) {
              window.location.href = payload.url;
              return;
            }

            setMessage(payload.message ?? "Unable to start bank connection.");
          })
        }
        disabled={isPending}
      >
        {isPending ? "Preparing..." : "Connect Bank"}
      </button>
      <button
        type="button"
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
        onClick={() =>
          startTransition(async () => {
            const response = await fetch("/api/basiq/sync", { method: "POST" });
            const payload = await response.json();
            setMessage(payload.message ?? `Synced ${payload.count ?? 0} transactions.`);
          })
        }
        disabled={isPending}
      >
        {isPending ? "Syncing..." : "Run Sync"}
      </button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
