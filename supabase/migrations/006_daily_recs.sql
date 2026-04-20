-- Daily company recommendations
create table if not exists daily_recs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null,
  date       date        not null,
  companies  jsonb       not null default '[]',
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table daily_recs enable row level security;
create policy "Users manage own daily recs" on daily_recs for all using (auth.uid() = user_id);

-- User feedback on daily recommendations
create table if not exists rec_feedback (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users(id) on delete cascade not null,
  company_name  text        not null,
  company_data  jsonb,
  liked         boolean     not null,
  created_at    timestamptz default now(),
  unique(user_id, company_name)
);

alter table rec_feedback enable row level security;
create policy "Users manage own rec feedback" on rec_feedback for all using (auth.uid() = user_id);
