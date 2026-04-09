-- Review and clean up highly likely CSV duplicates.
-- This version is intentionally conservative:
-- - csv provider only
-- - same household + account + date + amount + direction
-- - same normalized description fingerprint
-- - keeps the best row in each duplicate group:
--   1. posted over unknown over pending
--   2. none/confirmed_new over matched over ignored_duplicate
--   3. reviewed over auto_categorized over needs_review
--   4. earliest created row as final tie-breaker
--
-- This avoids treating legitimate repeated merchants across nearby dates
-- as duplicates.

-- =====================================================
-- 0. PARAMETERS
-- =====================================================

with params as (
  select
    null::date as review_start_date
)
select *
from params;

-- =====================================================
-- 1. PREVIEW DUPLICATE GROUPS
-- =====================================================

with params as (
  select
    null::date as review_start_date
),
base as (
  select
    t.id,
    t.household_id,
    t.source_account_name,
    t.date,
    t.amount,
    t.direction,
    t.authorization_status,
    t.pending_status,
    t.review_status,
    t.created_at,
    coalesce(
      nullif(
        regexp_replace(lower(trim(t.description_raw)), '\d+', ' ', 'g'),
        ''
      ),
      regexp_replace(lower(trim(t.merchant_raw)), '\d+', ' ', 'g')
    ) as description_fingerprint
  from transactions t
  cross join params p
  where t.provider = 'csv'
    and (p.review_start_date is null or t.date >= p.review_start_date)
),
groups as (
  select
    household_id,
    source_account_name,
    date,
    amount,
    direction,
    description_fingerprint,
    count(*) as row_count,
    array_agg(id order by created_at asc, id asc) as transaction_ids
  from base
  group by
    household_id,
    source_account_name,
    date,
    amount,
    direction,
    description_fingerprint
  having count(*) > 1
)
select
  household_id,
  source_account_name,
  date,
  amount,
  direction,
  description_fingerprint,
  row_count,
  transaction_ids
from groups
order by date desc, source_account_name, amount;

-- =====================================================
-- 2. PREVIEW INDIVIDUAL ROWS THAT WOULD BE REMOVED
-- =====================================================

with params as (
  select
    null::date as review_start_date
),
base as (
  select
    t.*,
    coalesce(
      nullif(
        regexp_replace(lower(trim(t.description_raw)), '\d+', ' ', 'g'),
        ''
      ),
      regexp_replace(lower(trim(t.merchant_raw)), '\d+', ' ', 'g')
    ) as description_fingerprint
  from transactions t
  cross join params p
  where t.provider = 'csv'
    and (p.review_start_date is null or t.date >= p.review_start_date)
),
ranked as (
  select
    base.*,
    row_number() over (
      partition by
        base.household_id,
        base.source_account_name,
        base.date,
        base.amount,
        base.direction,
        base.description_fingerprint
      order by
        case base.authorization_status
          when 'posted' then 0
          when 'unknown' then 1
          when 'pending' then 2
          else 3
        end,
        case base.pending_status
          when 'none' then 0
          when 'confirmed_new' then 1
          when 'matched' then 2
          when 'ignored_duplicate' then 3
          else 4
        end,
        case base.review_status
          when 'reviewed' then 0
          when 'auto_categorized' then 1
          when 'needs_review' then 2
          else 3
        end,
        base.created_at asc,
        base.id asc
    ) as rn,
    count(*) over (
      partition by
        base.household_id,
        base.source_account_name,
        base.date,
        base.amount,
        base.direction,
        base.description_fingerprint
    ) as group_count
  from base
)
select
  id,
  household_id,
  source_account_name,
  date,
  merchant_raw,
  description_raw,
  amount,
  direction,
  final_category,
  authorization_status,
  pending_status,
  review_status,
  created_at
from ranked
where group_count > 1
  and rn > 1
order by date desc, source_account_name, amount, created_at;

-- =====================================================
-- 3. BACKUP + DELETE EXTRAS
-- Run this section only after reviewing the previews above.
-- =====================================================

begin;

create table if not exists transactions_recent_csv_dedupe_backup
as
select *
from transactions
where false;

create table if not exists manual_overrides_recent_csv_dedupe_backup
as
select *
from manual_transaction_overrides
where false;

create temporary table recent_csv_duplicate_rows_to_remove on commit drop as
with params as (
  select
    null::date as review_start_date
),
base as (
  select
    t.*,
    coalesce(
      nullif(
        regexp_replace(lower(trim(t.description_raw)), '\d+', ' ', 'g'),
        ''
      ),
      regexp_replace(lower(trim(t.merchant_raw)), '\d+', ' ', 'g')
    ) as description_fingerprint
  from transactions t
  cross join params p
  where t.provider = 'csv'
    and (p.review_start_date is null or t.date >= p.review_start_date)
),
ranked as (
  select
    base.id,
    row_number() over (
      partition by
        base.household_id,
        base.source_account_name,
        base.date,
        base.amount,
        base.direction,
        base.description_fingerprint
      order by
        case base.authorization_status
          when 'posted' then 0
          when 'unknown' then 1
          when 'pending' then 2
          else 3
        end,
        case base.pending_status
          when 'none' then 0
          when 'confirmed_new' then 1
          when 'matched' then 2
          when 'ignored_duplicate' then 3
          else 4
        end,
        case base.review_status
          when 'reviewed' then 0
          when 'auto_categorized' then 1
          when 'needs_review' then 2
          else 3
        end,
        base.created_at asc,
        base.id asc
    ) as rn,
    count(*) over (
      partition by
        base.household_id,
        base.source_account_name,
        base.date,
        base.amount,
        base.direction,
        base.description_fingerprint
    ) as group_count
  from base
)
select id
from ranked
where group_count > 1
  and rn > 1;

insert into transactions_recent_csv_dedupe_backup
select t.*
from transactions t
join recent_csv_duplicate_rows_to_remove d on d.id = t.id;

insert into manual_overrides_recent_csv_dedupe_backup
select m.*
from manual_transaction_overrides m
join recent_csv_duplicate_rows_to_remove d on d.id = m.transaction_id;

delete from manual_transaction_overrides
where transaction_id in (
  select id from recent_csv_duplicate_rows_to_remove
);

delete from transactions
where id in (
  select id from recent_csv_duplicate_rows_to_remove
);

commit;

-- =====================================================
-- 4. VERIFY REMAINING DUPLICATE GROUPS
-- =====================================================

with params as (
  select
    null::date as review_start_date
),
base as (
  select
    t.id,
    t.household_id,
    t.source_account_name,
    t.date,
    t.amount,
    t.direction,
    coalesce(
      nullif(
        regexp_replace(lower(trim(t.description_raw)), '\d+', ' ', 'g'),
        ''
      ),
      regexp_replace(lower(trim(t.merchant_raw)), '\d+', ' ', 'g')
    ) as description_fingerprint,
    t.created_at
  from transactions t
  cross join params p
  where t.provider = 'csv'
    and (p.review_start_date is null or t.date >= p.review_start_date)
)
select
  household_id,
  source_account_name,
  date,
  amount,
  direction,
  description_fingerprint,
  count(*) as row_count
from base
group by
  household_id,
  source_account_name,
  date,
  amount,
  direction,
  description_fingerprint
having count(*) > 1
order by date desc, source_account_name, amount;
