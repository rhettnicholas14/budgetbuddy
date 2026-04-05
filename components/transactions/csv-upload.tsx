"use client";

import { useState, useTransition } from "react";

export function CsvUpload() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
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
        CSV statement upload
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
  );
}
