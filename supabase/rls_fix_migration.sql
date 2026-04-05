create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

grant execute on function public.is_household_member(uuid) to authenticated;

drop policy if exists "households visible to members" on households;
create policy "households visible to members"
on households
for all
using (public.is_household_member(id))
with check (public.is_household_member(id));

drop policy if exists "household_members visible to household members" on household_members;
create policy "household_members visible to household members"
on household_members
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "accounts visible to household members" on accounts;
create policy "accounts visible to household members"
on accounts
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "merchant_rules visible to household members" on merchant_rules;
create policy "merchant_rules visible to household members"
on merchant_rules
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "budgets visible to household members" on budgets;
create policy "budgets visible to household members"
on budgets
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "imported_files visible to household members" on imported_files;
create policy "imported_files visible to household members"
on imported_files
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "sync_runs visible to household members" on sync_runs;
create policy "sync_runs visible to household members"
on sync_runs
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "bank connections visible to household members" on household_bank_connections;
create policy "bank connections visible to household members"
on household_bank_connections
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "transactions visible to household members" on transactions;
create policy "transactions visible to household members"
on transactions
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "manual overrides visible to household members" on manual_transaction_overrides;
create policy "manual overrides visible to household members"
on manual_transaction_overrides
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
