insert into categories (slug, label, category_group, budgeted, review_by_default, accent)
values
  ('bills', 'Bills', 'ignore', false, false, '#8fa3ad'),
  ('fixed_cc', 'Fixed CC', 'spend', true, false, '#244855'),
  ('groceries', 'Groceries', 'spend', true, false, '#4e7f52'),
  ('essential_variable', 'Essential Variable', 'spend', true, false, '#6d8d9e'),
  ('lifestyle', 'Lifestyle', 'spend', true, false, '#ef7d57'),
  ('one_off', 'One-Off', 'spend', true, false, '#cc5b5b'),
  ('mortgage', 'Mortgage', 'ignore', false, false, '#5f6b8a'),
  ('mortgage_extra', 'Mortgage Extra', 'ignore', false, false, '#7887a5'),
  ('childcare', 'Childcare', 'ignore', false, false, '#6f6fb0'),
  ('childcare_rebate', 'Childcare Rebate', 'offset', false, false, '#99b898'),
  ('transfer', 'Transfer', 'ignore', false, false, '#9da7b1'),
  ('kids_savings', 'Kids Savings', 'ignore', false, false, '#7a9e9f'),
  ('rebate', 'Rebate', 'offset', false, false, '#a3bf7a'),
  ('income', 'Income', 'offset', false, false, '#58a56f'),
  ('review', 'Review - Split', 'ignore', false, true, '#d7a44d'),
  ('uncategorized', 'Review', 'ignore', false, true, '#b56f6f')
on conflict (slug) do update
set label = excluded.label,
    category_group = excluded.category_group,
    budgeted = excluded.budgeted,
    review_by_default = excluded.review_by_default,
    accent = excluded.accent;

with household as (
  insert into households (name, cycle_start_day, cycle_target)
  values ('Demo Household', 22, 8500)
  returning id
), budget as (
  insert into budgets (household_id, cycle_target, lifestyle_target, groceries_target, fixed_target, essential_variable_target, one_off_target)
  select id, 8500, 1500, 1600, 2200, 700, 900 from household
), rules as (
  insert into merchant_rules (household_id, merchant_pattern, normalized_merchant, category_slug, match_type, priority, split_merchant)
  select
    household.id,
    rule.merchant_pattern,
    rule.merchant_pattern,
    rule.category_slug,
    'exact',
    rule.priority,
    rule.category_slug = 'review'
  from household,
  (values
    ('Woolworths', 'groceries', 1),
    ('Coles', 'groceries', 2),
    ('ALDI', 'groceries', 3),
    ('Telstra', 'fixed_cc', 4),
    ('Youi', 'fixed_cc', 5),
    ('Medibank', 'fixed_cc', 6),
    ('Powershop', 'fixed_cc', 7),
    ('Netflix', 'fixed_cc', 8),
    ('Apple', 'review', 9),
    ('Amazon', 'review', 10),
    ('Square', 'lifestyle', 11),
    ('Uber Eats', 'lifestyle', 12),
    ('Dan Murphy''s', 'lifestyle', 13),
    ('Qantas', 'one_off', 14),
    ('Cabrini', 'one_off', 15),
    ('Salary', 'income', 16),
    ('Medicare', 'rebate', 17),
    ('CCS', 'childcare_rebate', 18),
    ('Mortgage', 'mortgage', 19),
    ('Mortgage Extra', 'mortgage_extra', 20),
    ('Childcare', 'childcare', 21),
    ('Credit Card Payment', 'transfer', 22)
  ) as rule(merchant_pattern, category_slug, priority)
)
select 'seed complete';
