export default function Loading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <div className="rounded-[28px] border border-white/70 bg-white/90 px-6 py-5 text-center shadow-[0_20px_60px_rgba(38,56,76,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Loading</p>
        <p className="mt-2 text-base text-slate-700">Pulling together your latest household spend.</p>
      </div>
    </div>
  );
}
