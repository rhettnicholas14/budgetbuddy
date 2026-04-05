# Household Spend Tracker

Mobile-first shared household finance dashboard built with Next.js App Router, TypeScript, Tailwind CSS, Supabase, and Basiq, with CSV fallback and PWA support.

## What is included

- Mobile-first dashboard optimized for phone screens and iPhone Safari
- Shared two-user household model
- Supabase schema and seed SQL
- Demo mode with realistic sample data
- Merchant normalization and category resolution engine
- Current cycle dashboard using a 22nd to 21st budget window
- Transactions screen with search, filters, and recategorization
- Review queue for uncertain and split-merchant transactions
- Trends charts for cycle or calendar periods
- Settings page with merchant mappings, Basiq connect, and CSV import
- AI category suggestions for review items
- AI budget insights for dashboard analysis
- Netlify deployment config
- PWA manifest, installable icons, and service worker

## Tech stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase auth and database
- OpenAI for category suggestions and insight summaries
- Basiq integration service layer
- Recharts for lightweight mobile-friendly charts
- Netlify deployment via `@netlify/plugin-nextjs`

## Quick start

1. Install dependencies.

```bash
npm install
```

2. Copy the environment file.

```bash
cp .env.example .env.local
```

3. Start in demo mode.

```bash
npm run dev
```

4. Open `http://localhost:3000`.

With `NEXT_PUBLIC_APP_MODE=demo`, the app boots directly into seeded household data and supports:

- mock Basiq connect and sync
- CSV import using [`public/demo-transactions.csv`](/Users/rhettnicholas/dev/BudgetBuddy/public/demo-transactions.csv)
- local demo reset from Settings

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](/Users/rhettnicholas/dev/BudgetBuddy/supabase/schema.sql).
3. Run [`supabase/seed.sql`](/Users/rhettnicholas/dev/BudgetBuddy/supabase/seed.sql).
4. Create two auth users in Supabase Auth.
5. Insert those users into `profiles` and `household_members` for the same household.
6. Set:

```env
NEXT_PUBLIC_APP_MODE=live
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

If you created the schema from an earlier revision of this project, also run [`supabase/rls_fix_migration.sql`](/Users/rhettnicholas/dev/BudgetBuddy/supabase/rls_fix_migration.sql) to replace the recursive RLS policies.

If you have a legacy merchant-classification list from an earlier spreadsheet or schema, run [`supabase/align_existing_classifications.sql`](/Users/rhettnicholas/dev/BudgetBuddy/supabase/align_existing_classifications.sql) to translate it into the current merchant rule model and backfill existing transactions without overwriting manual overrides.

If you are adding AI features to an existing database, also run [`supabase/ai_migration.sql`](/Users/rhettnicholas/dev/BudgetBuddy/supabase/ai_migration.sql).

## OpenAI setup

Set these environment variables:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

AI is used for:

- category suggestions on review-queue transactions
- concise budget insights on the dashboard

The AI layer is additive:

- manual override still wins
- exact merchant rules still run first
- AI suggestions are meant to help review, not replace your controls

## Basiq setup

Set these environment variables:

```env
BASIQ_API_KEY=...
BASIQ_API_URL=https://au-api.basiq.io
BASIQ_WEBHOOK_SECRET=...
```

Current Basiq support includes:

- connect-link endpoint at [`app/api/basiq/connect/route.ts`](/Users/rhettnicholas/dev/BudgetBuddy/app/api/basiq/connect/route.ts)
- sync endpoint at [`app/api/basiq/sync/route.ts`](/Users/rhettnicholas/dev/BudgetBuddy/app/api/basiq/sync/route.ts)
- callback endpoint at [`app/api/basiq/callback/route.ts`](/Users/rhettnicholas/dev/BudgetBuddy/app/api/basiq/callback/route.ts)
- webhook placeholder at [`app/api/basiq/webhook/route.ts`](/Users/rhettnicholas/dev/BudgetBuddy/app/api/basiq/webhook/route.ts)

The service layer lives in:

- [`lib/basiq/client.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/basiq/client.ts)
- [`lib/basiq/service.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/basiq/service.ts)

If you are adding the full Basiq household connection flow to an existing database, also run [`supabase/basiq_migration.sql`](/Users/rhettnicholas/dev/BudgetBuddy/supabase/basiq_migration.sql).

## CSV fallback

CSV import accepts basic bank statement shapes with fields like:

- `date`
- `merchant`
- `description`
- `amount`
- `direction`
- `account`

Import path:

- [`app/api/csv/import/route.ts`](/Users/rhettnicholas/dev/BudgetBuddy/app/api/csv/import/route.ts)
- [`lib/csv/importer.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/csv/importer.ts)

## Domain model

Core tables:

- `households`
- `profiles`
- `household_members`
- `accounts`
- `transactions`
- `merchant_rules`
- `manual_transaction_overrides`
- `budgets`
- `sync_runs`
- `imported_files`
- `categories`

Key domain logic:

- merchant normalization: [`lib/domain/merchant-normalization.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/domain/merchant-normalization.ts)
- category resolution: [`lib/domain/categorization.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/domain/categorization.ts)
- cycle window logic: [`lib/domain/cycle.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/domain/cycle.ts)
- dashboard and trend selectors: [`lib/domain/selectors.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/domain/selectors.ts)

Override behavior follows the product rule:

- manual override wins first
- then exact merchant rule
- then inferred rule
- else review

## Demo data

Demo snapshot lives in:

- [`lib/mock/data.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/mock/data.ts)
- [`lib/mock/store.ts`](/Users/rhettnicholas/dev/BudgetBuddy/lib/mock/store.ts)

You can print the seed payload with:

```bash
npm run seed:demo
```

## Netlify deployment

This repo includes [`netlify.toml`](/Users/rhettnicholas/dev/BudgetBuddy/netlify.toml).

Set these environment variables in Netlify:

- `NEXT_PUBLIC_APP_MODE`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `BASIQ_API_KEY`
- `BASIQ_API_URL`
- `BASIQ_WEBHOOK_SECRET`

Build command:

```bash
npm run build
```

## Notes

- Demo mode is the default so the app is useful immediately.
- The app is intentionally optimized for fast weekly household review, not accounting-style bookkeeping.
- `Lifestyle` is surfaced prominently as the main controllable spend lever.
