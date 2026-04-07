alter table transactions
  add column if not exists authorization_status text not null default 'unknown'
    check (authorization_status in ('pending', 'posted', 'unknown'));

alter table transactions
  add column if not exists pending_status text not null default 'none'
    check (pending_status in ('none', 'matched', 'confirmed_new', 'ignored_duplicate'));

alter table transactions
  add column if not exists pending_match_transaction_id uuid references transactions(id) on delete set null;

create index if not exists transactions_pending_status_idx
on transactions (household_id, pending_status, date desc);

create index if not exists transactions_pending_match_idx
on transactions (pending_match_transaction_id)
where pending_match_transaction_id is not null;
