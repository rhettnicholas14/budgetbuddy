-- Second-pass merchant alignment for the live Nicholas household.
--
-- Purpose:
-- - add exact-match aliases for merchants that still remained uncategorized
--   or stuck in review after the first alignment pass
-- - keep intentional split/review merchants as review
-- - never overwrite manual overrides
--
-- If your primary transaction household id changes later, replace the UUID
-- in target_household below.

with target_household as (
  select '705748be-91d5-4d28-86b6-fc6acef1dc70'::uuid as id
),
remaining_rules(merchant_normalized, category_slug, split_merchant) as (
  values
    ('Apple App Store', 'review', true),
    ('Portsea Hotel', 'lifestyle', false),
    ('Governors Hall', 'lifestyle', false),
    ('Amazon', 'review', true),
    ('Brumby''s Sorrento', 'groceries', false),
    ('Collective Cafe Christchurch', 'lifestyle', false),
    ('Scicluna''s Tooronga Village', 'lifestyle', false),
    ('Jessica Ann Pow', 'review', false),
    ('Liquorland Tooronga', 'lifestyle', false),
    ('Australia Acl Pty', 'review', false),
    ('Target Chadstone', 'lifestyle', false),
    ('Friends Of Mine', 'lifestyle', false),
    ('Humanitix', 'review', false),
    ('Bunnings Box Hill', 'lifestyle', false),
    ('Uniqlo Chadstone Shopping', 'lifestyle', false),
    ('Jb Hi Fi', 'lifestyle', false),
    ('Seed Heritage Camberwell', 'lifestyle', false),
    ('Mcdonald''s Peninsula Link', 'lifestyle', false),
    ('Mcdonald''s Malvern East', 'lifestyle', false),
    ('New World Ilam', 'groceries', false),
    ('Starlight Asian Market', 'groceries', false),
    ('Ikea Victoria Gardens', 'lifestyle', false),
    ('Nespresso', 'review', false),
    ('Temu Australia', 'lifestyle', false),
    ('Bunnings Hawthorn', 'lifestyle', false),
    ('Rising Sun Hotel', 'lifestyle', false),
    ('The Sackville Hotel', 'lifestyle', false),
    ('Yarra City Council', 'lifestyle', false),
    ('Mount Erica Hotel', 'lifestyle', false),
    ('Riversdale Hotel', 'lifestyle', false),
    ('Petstock Hawthorn East', 'lifestyle', false),
    ('Aramintas Co', 'review', false),
    ('Daiso Chadstone', 'lifestyle', false),
    ('Nigel Incredible Coffee', 'lifestyle', false),
    ('Paystay', 'lifestyle', false),
    ('Too Good To', 'review', false),
    ('Scicluna''s Sorrento', 'lifestyle', false),
    ('Freshchoice', 'groceries', false),
    ('Easypark', 'lifestyle', false),
    ('Ride On Entertainment', 'lifestyle', false),
    ('Pest Police Australia', 'review', false),
    ('Zlr Koto Community', 'lifestyle', false),
    ('Barcarolina Nb South', 'lifestyle', false),
    ('Strandbags Chadstone', 'lifestyle', false),
    ('Malvern Valley Golf', 'lifestyle', false),
    ('Melbourne Airport', 'one_off', false),
    ('Ortc Clothing Co', 'lifestyle', false),
    ('Mydna O South', 'review', false),
    ('North Bondi Fish', 'lifestyle', false),
    ('Rambler Christchurch', 'lifestyle', false),
    ('Lotte Duty Free', 'one_off', false),
    ('Bunnings Rosebud', 'lifestyle', false),
    ('Sam Liquor Wines', 'lifestyle', false),
    ('Marlo''s Beauty Therapy', 'review', false),
    ('Sussan', 'lifestyle', false),
    ('Bunnings', 'lifestyle', false),
    ('Platypus Shoes Sorrento', 'lifestyle', false),
    ('Sorrento Cellars', 'review', false),
    ('Bws Sorrento Vic', 'review', false),
    ('Mitre Sorrento', 'review', false),
    ('Georg Jensen Sydney', 'lifestyle', false),
    ('Koh', 'review', false),
    ('Dymocks Chadstone Shopping', 'lifestyle', false),
    ('Cannings Free Range', 'groceries', false),
    ('Hawkes Farm', 'groceries', false),
    ('Shoes Sox Camberwell', 'lifestyle', false),
    ('Entire Golf At', 'lifestyle', false),
    ('Grouptogether', 'review', false),
    ('Mecca Cosmetica Armadale', 'lifestyle', false),
    ('Eggs Direct', 'groceries', false),
    ('Breakfree On Cashel', 'one_off', false),
    ('Mecca Cosmetica Camberwell', 'lifestyle', false),
    ('Pin Payments', 'review', false),
    ('Jetstar', 'one_off', false),
    ('Bunnings Chadstone', 'lifestyle', false),
    ('Camberwell Market Florist', 'review', false),
    ('The Barbers Son', 'lifestyle', false),
    ('Big Bang Little', 'review', false),
    ('Van Gogh Flowers', 'lifestyle', false),
    ('Bp Balgowlah', 'lifestyle', false),
    ('Three Little Pigs', 'lifestyle', false),
    ('Bonds', 'lifestyle', false),
    ('The Clubrooms Cafe', 'lifestyle', false),
    ('Rejuvenate Beauty Brows', 'lifestyle', false),
    ('Washed Camberwell', 'lifestyle', false),
    ('The Bakers Wife', 'groceries', false),
    ('Ezy Plaza Aspendale', 'review', false),
    ('Mcdonald''s', 'lifestyle', false),
    ('Sorrento Sailing Couta', 'review', false),
    ('Maita Chadstone', 'review', false),
    ('Hotel Steyne', 'lifestyle', false),
    ('Marrickville Golf Club', 'lifestyle', false),
    ('Country Road', 'lifestyle', false),
    ('Baked In Portsea', 'groceries', false),
    ('Forget Me Not', 'lifestyle', false),
    ('Interpark William St', 'lifestyle', false),
    ('Dumplings Plus Chadstone', 'lifestyle', false),
    ('Phuoc Thanh Bakery', 'groceries', false),
    ('Officeworks Camberwell', 'lifestyle', false),
    ('The Loft Bar', 'lifestyle', false),
    ('Doordash', 'lifestyle', false),
    ('Sanctuary Co', 'lifestyle', false),
    ('Daikokuten', 'lifestyle', false),
    ('Pantry Glen Iris', 'groceries', false),
    ('Rye Bowls Club', 'lifestyle', false),
    ('The Trustee For', 'review', false),
    ('Allure Party Home', 'lifestyle', false),
    ('Baker Bleu South', 'groceries', false),
    ('Mcdonald''s Heidelberg Heights', 'lifestyle', false),
    ('Mcdonald''s Chadstone Shopping', 'lifestyle', false),
    ('Baby Bunting Hawthorn', 'lifestyle', false),
    ('Market Lane Coffee', 'lifestyle', false),
    ('Big W', 'lifestyle', false),
    ('Rumour Has It', 'lifestyle', false),
    ('Studio Dorchester', 'lifestyle', false),
    ('Cru+', 'lifestyle', false),
    ('Officeworks', 'lifestyle', false),
    ('Country Road Camberwell', 'lifestyle', false)
),
updated_rules as (
  update merchant_rules mr
  set
    merchant_pattern = rr.merchant_normalized,
    normalized_merchant = rr.merchant_normalized,
    match_type = 'exact',
    category_slug = rr.category_slug,
    priority = 100,
    split_merchant = rr.split_merchant,
    active = true,
    updated_at = now()
  from remaining_rules rr
  cross join target_household th
  where mr.household_id = th.id
    and lower(trim(mr.normalized_merchant)) = lower(trim(rr.merchant_normalized))
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
    rr.merchant_normalized,
    rr.merchant_normalized,
    'exact',
    rr.category_slug,
    100,
    rr.split_merchant,
    true
  from remaining_rules rr
  cross join target_household th
  where not exists (
    select 1
    from merchant_rules existing
    where existing.household_id = th.id
      and lower(trim(existing.normalized_merchant)) = lower(trim(rr.merchant_normalized))
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
  cross join target_household th
  where t.household_id = th.id
    and mr.household_id = th.id
    and mr.active = true
    and mr.match_type = 'exact'
    and lower(trim(t.merchant_normalized)) = lower(trim(mr.normalized_merchant))
    and t.merchant_normalized in (select merchant_normalized from remaining_rules)
  returning t.id
)
select
  (select count(*) from updated_rules) as rules_updated,
  (select count(*) from inserted_rules) as rules_inserted,
  (select count(*) from aligned_transactions) as transactions_aligned;
