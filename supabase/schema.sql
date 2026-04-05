create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cycle_start_day integer not null default 22 check (cycle_start_day between 1 and 28),
  cycle_target numeric(12,2) not null default 8500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  category_group text not null check (category_group in ('spend', 'offset', 'ignore')),
  budgeted boolean not null default false,
  review_by_default boolean not null default false,
  accent text not null default '#8fa3ad'
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  provider text not null check (provider in ('basiq', 'csv', 'manual')),
  provider_account_id text,
  institution_name text not null,
  source_account_name text not null,
  source_account_type text not null check (source_account_type in ('transaction', 'credit_card', 'savings', 'loan')),
  balance numeric(12,2) not null default 0,
  mask text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists accounts_household_provider_provider_account_id_idx
on accounts (household_id, provider, provider_account_id)
where provider_account_id is not null;

create table if not exists merchant_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  merchant_pattern text not null,
  normalized_merchant text not null,
  match_type text not null default 'exact' check (match_type in ('exact', 'contains')),
  category_slug text not null references categories(slug),
  priority integer not null default 100,
  split_merchant boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  cycle_target numeric(12,2) not null default 8500,
  lifestyle_target numeric(12,2) not null default 1500,
  groceries_target numeric(12,2) not null default 1600,
  fixed_target numeric(12,2) not null default 2200,
  essential_variable_target numeric(12,2) not null default 700,
  one_off_target numeric(12,2) not null default 900,
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists imported_files (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  filename text not null,
  source text not null check (source in ('csv', 'manual')),
  imported_by uuid references auth.users(id),
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  provider text not null check (provider in ('basiq', 'csv')),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  message text,
  imported_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists household_bank_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  provider text not null check (provider in ('basiq')),
  basiq_user_id text not null,
  external_connection_id text,
  auth_link_url text,
  institution_code text,
  institution_name text,
  status text not null default 'pending' check (status in ('pending', 'active', 'invalid', 'revoked', 'syncing')),
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, provider, basiq_user_id)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  provider text not null check (provider in ('basiq', 'csv', 'manual')),
  provider_transaction_id text not null,
  source_type text not null check (source_type in ('bank_feed', 'csv', 'manual')),
  date date not null,
  posted_at timestamptz,
  merchant_raw text not null,
  merchant_normalized text not null,
  description_raw text not null,
  amount numeric(12,2) not null,
  direction text not null check (direction in ('debit', 'credit')),
  source_account_name text not null,
  source_account_type text not null check (source_account_type in ('transaction', 'credit_card', 'savings', 'loan')),
  auto_category text references categories(slug),
  override_category text references categories(slug),
  final_category text not null references categories(slug),
  review_status text not null default 'needs_review' check (review_status in ('needs_review', 'reviewed', 'auto_categorized')),
  notes text,
  ai_suggested_category text references categories(slug),
  ai_confidence numeric(5,2),
  ai_reason text,
  is_reimbursement boolean not null default false,
  cycle_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, provider, provider_transaction_id)
);

create table if not exists manual_transaction_overrides (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  category_slug text not null references categories(slug),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (transaction_id)
);

alter table households enable row level security;
alter table profiles enable row level security;
alter table household_members enable row level security;
alter table categories enable row level security;
alter table accounts enable row level security;
alter table merchant_rules enable row level security;
alter table budgets enable row level security;
alter table imported_files enable row level security;
alter table sync_runs enable row level security;
alter table household_bank_connections enable row level security;
alter table transactions enable row level security;
alter table manual_transaction_overrides enable row level security;

create policy "categories readable by authenticated users"
on categories for select using (auth.role() = 'authenticated');

create policy "households visible to members"
on households for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = households.id and hm.user_id = auth.uid()
  )
);

create policy "profiles visible to self"
on profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "household_members visible to household members"
on household_members for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_members.household_id and hm.user_id = auth.uid()
  )
);

create policy "accounts visible to household members"
on accounts for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = accounts.household_id and hm.user_id = auth.uid()
  )
);

create policy "merchant_rules visible to household members"
on merchant_rules for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = merchant_rules.household_id and hm.user_id = auth.uid()
  )
);

create policy "budgets visible to household members"
on budgets for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = budgets.household_id and hm.user_id = auth.uid()
  )
);

create policy "imported_files visible to household members"
on imported_files for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = imported_files.household_id and hm.user_id = auth.uid()
  )
);

create policy "sync_runs visible to household members"
on sync_runs for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = sync_runs.household_id and hm.user_id = auth.uid()
  )
);

create policy "bank connections visible to household members"
on household_bank_connections for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_bank_connections.household_id and hm.user_id = auth.uid()
  )
);

create policy "transactions visible to household members"
on transactions for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = transactions.household_id and hm.user_id = auth.uid()
  )
);

create policy "manual overrides visible to household members"
on manual_transaction_overrides for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = manual_transaction_overrides.household_id and hm.user_id = auth.uid()
  )
);
