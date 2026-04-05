-- Align legacy merchant classifications with the current app schema.
-- Safe behavior:
-- 1. inserts or updates merchant rules in the current merchant_rules table
-- 2. maps legacy category labels to current category slugs
-- 3. updates transactions by merchant_normalized
-- 4. never overwrites manual overrides; override_category always wins
--
-- Assumption:
-- - one household, or you want to target the earliest created household
-- If you have multiple households, replace target_household CTE with a specific id.

with target_household as (
  select id
  from households
  order by created_at asc
  limit 1
),
legacy_rules(merchant_normalized, legacy_category, basis) as (
  values
    ('Boroondara City Council', 'Bills', 'Covered in $1,100 bills account'),
    ('Vicroads', 'Bills', 'Covered in $1,100 bills account'),
    ('Yarra Valley Water', 'Bills', 'Covered in $1,100 bills account'),
    ('Bills', 'Transfer', 'Monthly transfer to bills account'),
    ('CCS', 'Childcare Rebate', 'Savings-side childcare subsidy'),
    ('Amcal Chemist Stockland', 'Essential Variable', 'Confirmed ongoing health baseline'),
    ('Auburn South Primary', 'Essential Variable', 'School-related recurring child cost'),
    ('Camberwell Junction Dental', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Chemist Warehouse', 'Essential Variable', 'Confirmed medication / health baseline'),
    ('Dpn Psychology Mount', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Dr Melvyn J', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Eleven', 'Essential Variable', '7-Eleven petrol'),
    ('Eleven Toorak Rd', 'Essential Variable', '7-Eleven petrol'),
    ('Elite Myotherapy Hawthorn', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Flexischools', 'Essential Variable', 'School / kids recurring cost'),
    ('Glenferrie Road Medical', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Jigsaw Chiropractic', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Kids Garage', 'Essential Variable', 'School / kids recurring cost'),
    ('Marc Clavin Pharmacy', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Qi Master Massage', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Spartan School Supplies', 'Essential Variable', 'School / kids recurring cost'),
    ('St Kilda Football', 'Essential Variable', 'School / kids recurring cost'),
    ('Tyro Health', 'Essential Variable', 'Inferred health / baseline essential'),
    ('Club Lime', 'Fixed CC', 'Confirmed fixed membership'),
    ('Disney Plus', 'Fixed CC', 'Confirmed recurring sub'),
    ('Linkt', 'Fixed CC', 'Confirmed tolls'),
    ('Medibank', 'Fixed CC', 'Confirmed recurring'),
    ('Netflix', 'Fixed CC', 'Confirmed recurring'),
    ('Netlify Netlify Com', 'Fixed CC', 'Netlify expense noted by user'),
    ('Ocean Fitness Sorrento', 'Fixed CC', 'Inferred recurring subscription / utility / service'),
    ('Openai Openai Com', 'Fixed CC', 'Inferred recurring subscription / utility / service'),
    ('Powershop', 'Fixed CC', 'Utility on CC'),
    ('Smooth Electra', 'Fixed CC', 'Inferred recurring subscription / utility / service'),
    ('Stan', 'Fixed CC', 'Confirmed recurring'),
    ('Telstra', 'Fixed CC', 'Confirmed recurring'),
    ('Ymca Hawthorn Aquatic', 'Fixed CC', 'Confirmed membership'),
    ('Youi', 'Fixed CC', 'Confirmed recurring insurance'),
    ('ALDI', 'Groceries', 'Confirmed from convo'),
    ('Baked In Portsea', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Baker Bleu South', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Bakers Delight', 'Groceries', 'Confirmed from convo'),
    ('Brumbys Sorrento', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Cannings Free Range', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Coles', 'Groceries', 'Confirmed from convo'),
    ('Eggs Direct', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Freshchoice', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Hawkes Farm', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('New World Ilam', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Pantry Glen Iris', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Phuoc Thanh Bakery', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Ritchies Supa Iga', 'Groceries', 'IGA / supermarket'),
    ('Starlight Asian Market', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('The Bakers Wife', 'Groceries', 'Inferred food-for-home / supermarket / bakery'),
    ('Woolworths', 'Groceries', 'Confirmed from convo'),
    ('From Mr Rhett', 'Income', 'Inflow / income'),
    ('Salary', 'Income', 'Savings-side income'),
    ('Kids Savings', 'Kids Savings', 'Internal savings transfer'),
    ('Allure Party Home', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Baby Bunting Hawthorn', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Barcarolina Nb South', 'Lifestyle', 'Eating out / social'),
    ('Big W', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Bonds', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Bp Balgowlah', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Bunnings', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Bunnings Box Hill', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Bunnings Chadstone', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Bunnings Hawthorn', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Bunnings Rosebud', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Collective Cafe Christchurch', 'Lifestyle', 'Eating out / social'),
    ('Country Road', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Country Road Camberwell', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Cru+', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Daikokuten', 'Lifestyle', 'Eating out / social'),
    ('Daiso Chadstone', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Dan Murphys', 'Lifestyle', 'Confirmed alcohol / social'),
    ('Doordash', 'Lifestyle', 'Eating out / social'),
    ('Dumplings Plus Chadstone', 'Lifestyle', 'Eating out / social'),
    ('Dymocks Chadstone Shopping', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Easypark', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Entire Golf At', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Forget Me Not', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Friends Of Mine', 'Lifestyle', 'Eating out / social'),
    ('Georg Jensen Sydney', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Governors Hall', 'Lifestyle', 'Eating out / social'),
    ('Hotel Steyne', 'Lifestyle', 'Eating out / social'),
    ('Ikea Victoria Gardens', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Interpark William St', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Jb Hi Fi', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Kmart Camberwell', 'Lifestyle', 'Confirmed retail / household discretionary'),
    ('Liquorland Tooronga', 'Lifestyle', 'Alcohol / social'),
    ('Malvern Valley Golf', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Market Lane Coffee', 'Lifestyle', 'Eating out / social'),
    ('Marrickville Golf Club', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Mcdonalds', 'Lifestyle', 'Eating out / social'),
    ('Mcdonalds Chadstone Shopping', 'Lifestyle', 'Eating out / social'),
    ('Mcdonalds Heidelberg Heights', 'Lifestyle', 'Eating out / social'),
    ('Mcdonalds Malvern East', 'Lifestyle', 'Eating out / social'),
    ('Mcdonalds Peninsula Link', 'Lifestyle', 'Eating out / social'),
    ('Mecca Cosmetica Armadale', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Mecca Cosmetica Camberwell', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Mount Erica Hotel', 'Lifestyle', 'Eating out / social'),
    ('Nigel Incredible Coffee', 'Lifestyle', 'Eating out / social'),
    ('North Bondi Fish', 'Lifestyle', 'Eating out / social'),
    ('Officeworks', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Officeworks Camberwell', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Ortc Clothing Co', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Paystay', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Petstock Hawthorn East', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Platypus Shoes Sorrento', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Portsea Hotel', 'Lifestyle', 'Eating out / social'),
    ('Rambler Christchurch', 'Lifestyle', 'Eating out / social'),
    ('Rejuvenate Beauty Brows', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Ride On Entertainment', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Rising Sun Hotel', 'Lifestyle', 'Eating out / social'),
    ('Riversdale Hotel', 'Lifestyle', 'Eating out / social'),
    ('Rumour Has It', 'Lifestyle', 'Eating out / social'),
    ('Rye Bowls Club', 'Lifestyle', 'Eating out / social'),
    ('Sam Liquor Wines', 'Lifestyle', 'Eating out / social'),
    ('Sanctuary Co', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Sciclunas Sorrento', 'Lifestyle', 'Eating out / social'),
    ('Sciclunas Tooronga Village', 'Lifestyle', 'Eating out / social'),
    ('Seed Heritage Camberwell', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Shoes Sox Camberwell', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Square', 'Lifestyle', 'Confirmed cafes / small discretionary'),
    ('Strandbags Chadstone', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Studio Dorchester', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Sussan', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Target Chadstone', 'Lifestyle', 'Confirmed discretionary retail'),
    ('Temu Australia', 'Lifestyle', 'Retail / discretionary shopping'),
    ('The Barbers Son', 'Lifestyle', 'Eating out / social'),
    ('The Clubrooms Cafe', 'Lifestyle', 'Eating out / social'),
    ('The Loft Bar', 'Lifestyle', 'Eating out / social'),
    ('The Sackville Hotel', 'Lifestyle', 'Eating out / social'),
    ('Three Little Pigs', 'Lifestyle', 'Eating out / social'),
    ('Transport Nsw', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Uber', 'Lifestyle', 'Confirmed discretionary transport'),
    ('Uber Eats', 'Lifestyle', 'Confirmed food delivery'),
    ('Uniqlo Chadstone Shopping', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Van Gogh Flowers', 'Lifestyle', 'Retail / discretionary shopping'),
    ('Washed Camberwell', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Waverley Council', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Yarra City Council', 'Lifestyle', 'Discretionary activity / parking / council leisure'),
    ('Zlr Koto Community', 'Lifestyle', 'Eating out / social'),
    ('Mortgage', 'Mortgage', 'Savings-side home loan'),
    ('Breakfree On Cashel', 'One-Off', 'Travel-related one-off'),
    ('Cabrini Health', 'One-Off', 'Confirmed event-based medical'),
    ('Dr Anita Yuen', 'One-Off', 'Confirmed event-based medical'),
    ('Jetstar', 'One-Off', 'Travel-related one-off'),
    ('Lotte Duty Free', 'One-Off', 'Travel-related one-off'),
    ('Melbourne Airport', 'One-Off', 'Travel-related one-off'),
    ('Qantas', 'One-Off', 'Confirmed travel one-off'),
    ('Medicare', 'Rebate', 'Do not count as spend'),
    ('Amazon', 'Review', 'Split merchant: subscription + purchases'),
    ('Apple App Store', 'Review', 'Split merchant: subs + one-offs'),
    ('Aramintas Co', 'Review', 'Needs manual check'),
    ('Australia Acl Pty', 'Review', 'Needs manual check'),
    ('Big Bang Little', 'Review', 'Needs manual check'),
    ('Bws Sorrento Vic', 'Review', 'Needs manual check'),
    ('Camberwell Market Florist', 'Review', 'Needs manual check'),
    ('Ezy Plaza Aspendale', 'Review', 'Needs manual check'),
    ('Grouptogether', 'Review', 'Needs manual check'),
    ('Humanitix', 'Review', 'Needs manual check'),
    ('Jessica Ann Pow', 'Review', 'Needs manual check'),
    ('Koh', 'Review', 'Needs manual check'),
    ('Maita Chadstone', 'Review', 'Needs manual check'),
    ('Marlos Beauty Therapy', 'Review', 'Needs manual check'),
    ('Mitre Sorrento', 'Review', 'Needs manual check'),
    ('Mydna O South', 'Review', 'Needs manual check'),
    ('Nespresso', 'Review', 'Needs manual check'),
    ('Pest Police Australia', 'Review', 'Needs manual check'),
    ('Pin Payments', 'Review', 'Needs manual check'),
    ('Sorrento Cellars', 'Review', 'Needs manual check'),
    ('Sorrento Sailing Couta', 'Review', 'Needs manual check'),
    ('The Trustee For', 'Review', 'Needs manual check'),
    ('Too Good To', 'Review', 'Needs manual check'),
    ('Credit Card Payment', 'Transfer', 'Not spending'),
    ('Internet Payment Linked', 'Transfer', 'Money movement / savings transfer'),
    ('Nab Intnl Tran', 'Transfer', 'Bank fee / transfer-related, not household spend control'),
    ('To Wedding Holiday', 'Transfer', 'Money movement / savings transfer'),
    ('Transfer', 'Transfer', 'Internal transfer')
),
mapped_rules as (
  select
    th.id as household_id,
    trim(lr.merchant_normalized) as merchant_pattern,
    trim(lr.merchant_normalized) as normalized_merchant,
    case lr.legacy_category
      when 'Bills' then 'bills'
      when 'Fixed CC' then 'fixed_cc'
      when 'Groceries' then 'groceries'
      when 'Essential Variable' then 'essential_variable'
      when 'Lifestyle' then 'lifestyle'
      when 'One-Off' then 'one_off'
      when 'Mortgage' then 'mortgage'
      when 'Mortgage Extra' then 'mortgage_extra'
      when 'Childcare' then 'childcare'
      when 'Childcare Rebate' then 'childcare_rebate'
      when 'Transfer' then 'transfer'
      when 'Bills Transfer' then 'transfer'
      when 'Kids Savings' then 'kids_savings'
      when 'Rebate' then 'rebate'
      when 'Income' then 'income'
      when 'Review' then 'review'
      else null
    end as category_slug,
    lr.basis,
    case
      when lower(trim(lr.merchant_normalized)) in ('amazon', 'apple app store') then true
      else false
    end as split_merchant
  from legacy_rules lr
  cross join target_household th
),
updated_rules as (
  update merchant_rules mr
  set
    merchant_pattern = mapped.merchant_pattern,
    normalized_merchant = mapped.normalized_merchant,
    category_slug = mapped.category_slug,
    match_type = 'exact',
    split_merchant = mapped.split_merchant,
    active = true,
    updated_at = now()
  from mapped_rules mapped
  where mr.household_id = mapped.household_id
    and lower(trim(mr.normalized_merchant)) = lower(trim(mapped.normalized_merchant))
    and mapped.category_slug is not null
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
    mapped.household_id,
    mapped.merchant_pattern,
    mapped.normalized_merchant,
    'exact',
    mapped.category_slug,
    100,
    mapped.split_merchant,
    true
  from mapped_rules mapped
  where mapped.category_slug is not null
    and not exists (
      select 1
      from merchant_rules existing
      where existing.household_id = mapped.household_id
        and lower(trim(existing.normalized_merchant)) = lower(trim(mapped.normalized_merchant))
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
  where t.household_id = mr.household_id
    and mr.active = true
    and mr.match_type = 'exact'
    and lower(trim(t.merchant_normalized)) = lower(trim(mr.normalized_merchant))
  returning t.id
)
select
  (select count(*) from updated_rules) as rules_updated,
  (select count(*) from inserted_rules) as rules_inserted,
  (select count(*) from aligned_transactions) as transactions_aligned;
