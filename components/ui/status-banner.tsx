export function StatusBanner({ status }: { status: string }) {
  if (!status) {
    return null;
  }

  const content =
    status === "saved"
      ? {
          title: "Saved",
          body: "Your transaction update was committed.",
          className: "border-emerald-200 bg-emerald-50 text-emerald-900",
        }
      : status === "rule-saved"
      ? {
          title: "Rule saved",
          body: "This merchant mapping is now stored for future transactions.",
          className: "border-emerald-200 bg-emerald-50 text-emerald-900",
        }
      : status === "rule-updated"
        ? {
            title: "Rule updated",
            body: "The merchant mapping changes were saved.",
            className: "border-emerald-200 bg-emerald-50 text-emerald-900",
          }
        : status === "rules-reapplied"
          ? {
              title: "Rules reapplied",
              body: "Existing transactions were rechecked against your current mapping rules.",
              className: "border-emerald-200 bg-emerald-50 text-emerald-900",
            }
        : status === "rule-deleted"
          ? {
              title: "Rule deleted",
              body: "The merchant mapping was removed.",
              className: "border-emerald-200 bg-emerald-50 text-emerald-900",
            }
          : status === "pending-confirmed"
            ? {
                title: "Marked as new",
                body: "This pending transaction will now count as its own transaction.",
                className: "border-emerald-200 bg-emerald-50 text-emerald-900",
              }
            : status === "pending-ignored"
              ? {
                  title: "Marked as duplicate",
                  body: "This matched pending transaction will stay out of your totals.",
                  className: "border-emerald-200 bg-emerald-50 text-emerald-900",
                }
        : {
            title: "Updated",
            body: "Your latest change was applied.",
            className: "border-slate-200 bg-slate-50 text-slate-900",
          };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${content.className}`}>
      <p className="text-sm font-semibold">{content.title}</p>
      <p className="mt-1 text-sm opacity-80">{content.body}</p>
    </div>
  );
}
