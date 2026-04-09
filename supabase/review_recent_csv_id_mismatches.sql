-- Review recent CSV duplicate candidates caused by legacy vs stable
-- provider_transaction_id formats.
--
-- Legacy format examples:
--   csv:Transactions (1).csv:14:02 Apr 26:-1.00:TfNSW Opal Fare SYDNEY 036
--
-- Current stable format examples:
--   csv:5efbd9d0a65e2e34973ae3fb27f16e60
--
-- This file is review-only. It does not update or delete anything.

-- =====================================================
-- 0. PARAMETERS
-- =====================================================

with params as (
  select
    current_date - interval '7 days' as review_start_timestamp,
    7::int as match_window_days
)
select *
from params;

-- =====================================================
-- 1. RECENT CSV LOADS BY DAY
-- =====================================================

with params as (
  select
    current_date - interval '7 days' as review_start_timestamp,
    7::int as match_window_days
)
select
  created_at::date as created_date,
  count(*) as transaction_count
from transactions t
cross join params p
where t.provider = 'csv'
  and t.created_at >= p.review_start_timestamp
group by created_date
order by created_date desc;

-- =====================================================
-- 2. RECENT ROWS WITH ID FORMAT CLASSIFICATION
-- =====================================================

with params as (
  select
    current_date - interval '7 days' as review_start_timestamp,
    7::int as match_window_days
)
select
  id,
  created_at,
  source_account_name,
  date,
  merchant_raw,
  description_raw,
  amount,
  direction,
  provider_transaction_id,
  case
    when provider_transaction_id ~ '^csv:[0-9a-f]{32}$' then 'stable_hash'
    when provider_transaction_id like 'csv:%.csv:%' then 'legacy_filename'
    else 'other'
  end as provider_transaction_id_format
from transactions t
cross join params p
where t.provider = 'csv'
  and t.created_at >= p.review_start_timestamp
order by created_at desc, date desc;

-- =====================================================
-- 3. EXACT DUPLICATE CANDIDATES WITH MIXED ID FORMATS
-- Same account/date/amount/direction/description fingerprint.
-- This is the safest review list for cleanup.
-- =====================================================

with params as (
  select
    current_date - interval '7 days' as review_start_timestamp,
    7::int as match_window_days
),
recent as (
  select
    t.id,
    t.created_at,
    t.household_id,
    t.source_account_name,
    t.date,
    t.amount,
    t.direction,
    t.merchant_raw,
    t.description_raw,
    t.provider_transaction_id,
    case
      when t.provider_transaction_id ~ '^csv:[0-9a-f]{32}$' then 'stable_hash'
      when t.provider_transaction_id like 'csv:%.csv:%' then 'legacy_filename'
      else 'other'
    end as provider_transaction_id_format,
    lower(trim(coalesce(nullif(t.description_raw, ''), t.merchant_raw))) as description_fingerprint
  from transactions t
  cross join params p
  where t.provider = 'csv'
    and t.created_at >= p.review_start_timestamp
),
ranked as (
  select
    recent.*,
    count(*) over (
      partition by
        recent.household_id,
        recent.source_account_name,
        recent.date,
        recent.amount,
        recent.direction,
        recent.description_fingerprint
    ) as group_count,
    count(*) filter (where recent.provider_transaction_id_format = 'legacy_filename') over (
      partition by
        recent.household_id,
        recent.source_account_name,
        recent.date,
        recent.amount,
        recent.direction,
        recent.description_fingerprint
    ) as legacy_count,
    count(*) filter (where recent.provider_transaction_id_format = 'stable_hash') over (
      partition by
        recent.household_id,
        recent.source_account_name,
        recent.date,
        recent.amount,
        recent.direction,
        recent.description_fingerprint
    ) as stable_count
  from recent
)
select
  household_id,
  source_account_name,
  date,
  amount,
  direction,
  description_fingerprint,
  group_count,
  legacy_count,
  stable_count,
  array_agg(id order by created_at desc) as transaction_ids,
  array_agg(provider_transaction_id order by created_at desc) as provider_transaction_ids,
  array_agg(created_at order by created_at desc) as created_ats
from ranked
where group_count > 1
  and legacy_count > 0
  and stable_count > 0
group by
  household_id,
  source_account_name,
  date,
  amount,
  direction,
  description_fingerprint,
  group_count,
  legacy_count,
  stable_count
order by date desc, source_account_name, amount desc;

-- =====================================================
-- 4. INDIVIDUAL ROWS FOR THOSE MIXED-FORMAT CANDIDATES
-- =====================================================

with params as (
  select
    current_date - interval '7 days' as review_start_timestamp,
    7::int as match_window_days
),
recent as (
  select
    t.*,
    case
      when t.provider_transaction_id ~ '^csv:[0-9a-f]{32}$' then 'stable_hash'
      when t.provider_transaction_id like 'csv:%.csv:%' then 'legacy_filename'
      else 'other'
    end as provider_transaction_id_format,
    lower(trim(coalesce(nullif(t.description_raw, ''), t.merchant_raw))) as description_fingerprint
  from transactions t
  cross join params p
  where t.provider = 'csv'
    and t.created_at >= p.review_start_timestamp
),
ranked as (
  select
    recent.*,
    count(*) over (
      partition by
        recent.household_id,
        recent.source_account_name,
        recent.date,
        recent.amount,
        recent.direction,
        recent.description_fingerprint
    ) as group_count,
    count(*) filter (where recent.provider_transaction_id_format = 'legacy_filename') over (
      partition by
        recent.household_id,
        recent.source_account_name,
        recent.date,
        recent.amount,
        recent.direction,
        recent.description_fingerprint
    ) as legacy_count,
    count(*) filter (where recent.provider_transaction_id_format = 'stable_hash') over (
      partition by
        recent.household_id,
        recent.source_account_name,
        recent.date,
        recent.amount,
        recent.direction,
        recent.description_fingerprint
    ) as stable_count
  from recent
)
select
  id,
  created_at,
  source_account_name,
  date,
  merchant_raw,
  description_raw,
  amount,
  direction,
  final_category,
  review_status,
  pending_status,
  provider_transaction_id,
  provider_transaction_id_format
from ranked
where group_count > 1
  and legacy_count > 0
  and stable_count > 0
order by date desc, source_account_name, amount desc, created_at desc;

-- =====================================================
-- 5. REVIEWABLE LEGACY VS STABLE NEAR-MATCH CANDIDATES
-- Same account + amount + direction + merchant, with dates within
-- the configured window. This is intended to catch the likely
-- "same transaction, different ID strategy" cases for manual review.
-- =====================================================

with params as (
  select
    current_date - interval '7 days' as review_start_timestamp,
    7::int as match_window_days
),
recent as (
  select
    t.id,
    t.created_at,
    t.household_id,
    t.source_account_name,
    t.date,
    t.amount,
    t.direction,
    t.merchant_raw,
    t.merchant_normalized,
    t.description_raw,
    t.provider_transaction_id,
    case
      when t.provider_transaction_id ~ '^csv:[0-9a-f]{32}$' then 'stable_hash'
      when t.provider_transaction_id like 'csv:%.csv:%' then 'legacy_filename'
      else 'other'
    end as provider_transaction_id_format
  from transactions t
  cross join params p
  where t.provider = 'csv'
    and t.created_at >= p.review_start_timestamp
),
stable_rows as (
  select *
  from recent
  where provider_transaction_id_format = 'stable_hash'
),
legacy_rows as (
  select *
  from recent
  where provider_transaction_id_format = 'legacy_filename'
)
select
  stable_rows.id as stable_id,
  stable_rows.created_at as stable_created_at,
  stable_rows.source_account_name,
  stable_rows.date as stable_date,
  legacy_rows.id as legacy_id,
  legacy_rows.created_at as legacy_created_at,
  legacy_rows.date as legacy_date,
  abs(stable_rows.date - legacy_rows.date) as date_gap_days,
  stable_rows.amount,
  stable_rows.direction,
  stable_rows.merchant_normalized,
  stable_rows.description_raw as stable_description_raw,
  legacy_rows.description_raw as legacy_description_raw,
  stable_rows.provider_transaction_id as stable_provider_transaction_id,
  legacy_rows.provider_transaction_id as legacy_provider_transaction_id
from stable_rows
join legacy_rows
  on stable_rows.household_id = legacy_rows.household_id
  and stable_rows.source_account_name = legacy_rows.source_account_name
  and stable_rows.amount = legacy_rows.amount
  and stable_rows.direction = legacy_rows.direction
  and stable_rows.merchant_normalized = legacy_rows.merchant_normalized
  and abs(stable_rows.date - legacy_rows.date) <= (select match_window_days from params)
order by
  stable_rows.created_at desc,
  date_gap_days asc,
  stable_rows.source_account_name,
  stable_rows.amount desc;
