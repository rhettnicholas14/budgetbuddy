"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DemoResetButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/demo/reset", { method: "POST" });
          router.refresh();
        })
      }
      disabled={isPending}
    >
      {isPending ? "Resetting..." : "Reset Demo Data"}
    </button>
  );
}
