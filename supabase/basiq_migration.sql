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

alter table household_bank_connections enable row level security;

create policy "bank connections visible to household members"
on household_bank_connections for all using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_bank_connections.household_id and hm.user_id = auth.uid()
  )
);

alter table accounts
  add column if not exists provider_account_id text;

create unique index if not exists accounts_household_provider_provider_account_id_idx
on accounts (household_id, provider, provider_account_id)
where provider_account_id is not null;
