import { signInAction } from "@/app/actions";
import { Card } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Household Spend Tracker</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Shared household finance, built for quick weekly check-ins.</h1>
        <p className="mt-3 text-base text-slate-600">
          Sign in to your shared household. In local demo mode, the app opens straight into seeded data.
        </p>
      </div>
      <Card className="space-y-4">
        <form action={signInAction} className="space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Password
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base"
              required
            />
          </label>
          <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">
            Sign In
          </button>
        </form>
        {params.error ? <p className="text-sm text-rose-700">{params.error}</p> : null}
      </Card>
    </main>
  );
}
