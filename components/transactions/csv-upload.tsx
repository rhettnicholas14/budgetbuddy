"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";

type CsvImportWatermark = {
  accountName: string;
  lastImportedDate: string;
};

export function CsvUpload({
  watermarks,
}: {
  watermarks: CsvImportWatermark[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">CSV statement upload</p>
        <p className="text-xs text-slate-500">
          Imports use a 7-day overlap window, then skip older rows and dedupe anything already loaded.
        </p>
      </div>

      {watermarks.length > 0 ? (
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Last imported through</p>
          <div className="mt-2 space-y-1.5">
            {watermarks.map((watermark) => (
              <div key={watermark.accountName} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-600">{watermark.accountName}</span>
                <span className="whitespace-nowrap font-semibold text-slate-900">
                  {format(new Date(watermark.lastImportedDate), "EEE d MMM yyyy")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-600">
          No CSV history yet. The first import will load the full file.
        </div>
      )}

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);

          startTransition(async () => {
            const response = await fetch("/api/csv/import", {
              method: "POST",
              body: formData,
            });

            const payload = await response.json();
            setMessage(payload.message ?? `Imported ${payload.count ?? 0} transactions.`);
          });
        }}
      >
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Select CSV file
          <input
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          disabled={isPending}
        >
          {isPending ? "Importing..." : "Import CSV"}
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>
    </div>
  );
}
