create table if not exists deal_flow (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id text not null,
  company_name text not null,
  status text not null,
  map_id uuid references saved_maps(id) on delete set null,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, company_id)
);
alter table deal_flow enable row level security;
create policy "Users manage own deal flow" on deal_flow for all using (auth.uid() = user_id);
