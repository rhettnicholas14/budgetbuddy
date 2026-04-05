alter table if exists transactions
  add column if not exists ai_suggested_category text references categories(slug),
  add column if not exists ai_confidence numeric(5,2),
  add column if not exists ai_reason text;
