-- Repair duplicate-household classification drift.
--
-- Use this when the same logical household has been created more than once and:
-- - one household has the imported transactions
-- - another household has the full merchant rule set
--
-- Safe behavior:
-- 1. finds the "rule source" household as the household with the most merchant rules
-- 2. copies those rules to every household that already has transactions
-- 3. updates existing matching rules instead of duplicating them
-- 4. backfills transaction categories from merchant rules
-- 5. never overwrites manual overrides

with household_stats as (
  select
    h.id,
    h.name,
    count(distinct t.id) as transaction_count,
    count(distinct mr.id) as merchant_rule_count
  from households h
  left join transactions t on t.household_id = h.id
  left join merchant_rules mr on mr.household_id = h.id
  group by h.id, h.name
),
rule_source as (
  select id, name
  from household_stats
  where merchant_rule_count > 0
  order by merchant_rule_count desc, transaction_count desc, name asc, id asc
  limit 1
),
target_households as (
  select hs.id, hs.name
  from household_stats hs
  cross join rule_source rs
  where hs.transaction_count > 0
    and hs.id <> rs.id
),
source_rules as (
  select
    mr.merchant_pattern,
    mr.normalized_merchant,
    mr.match_type,
    mr.category_slug,
    mr.priority,
    mr.split_merchant,
    mr.active
  from merchant_rules mr
  join rule_source rs on rs.id = mr.household_id
),
updated_rules as (
  update merchant_rules mr
  set
    merchant_pattern = sr.merchant_pattern,
    match_type = sr.match_type,
    category_slug = sr.category_slug,
    priority = sr.priority,
    split_merchant = sr.split_merchant,
    active = sr.active,
    updated_at = now()
  from target_households th
  join source_rules sr on true
  where mr.household_id = th.id
    and lower(trim(mr.normalized_merchant)) = lower(trim(sr.normalized_merchant))
  returning mr.id
),
inserted_rules as (
  insert into merchant_rules (
    household_id,
    merchant_pattern,
    normalized_merchant,
    match_type,
    category_slug,
    priority,
    split_merchant,
    active
  )
  select
    th.id,
    sr.merchant_pattern,
    sr.normalized_merchant,
    sr.match_type,
    sr.category_slug,
    sr.priority,
    sr.split_merchant,
    sr.active
  from target_households th
  cross join source_rules sr
  where not exists (
    select 1
    from merchant_rules existing
    where existing.household_id = th.id
      and lower(trim(existing.normalized_merchant)) = lower(trim(sr.normalized_merchant))
  )
  returning id
),
aligned_transactions as (
  update transactions t
  set
    auto_category = mr.category_slug,
    final_category = coalesce(t.override_category, mr.category_slug),
    review_status = case
      when t.override_category is not null then 'reviewed'
      when mr.category_slug = 'review' then 'needs_review'
      else 'auto_categorized'
    end,
    updated_at = now()
  from merchant_rules mr
  where t.household_id in (select id from target_households)
    and mr.household_id = t.household_id
    and mr.active = true
    and mr.match_type = 'exact'
    and lower(trim(t.merchant_normalized)) = lower(trim(mr.normalized_merchant))
  returning t.id
)
select
  (select id from rule_source) as source_household_id,
  (select name from rule_source) as source_household_name,
  (select count(*) from target_households) as target_households_updated,
  (select count(*) from updated_rules) as rules_updated,
  (select count(*) from inserted_rules) as rules_inserted,
  (select count(*) from aligned_transactions) as transactions_aligned;
