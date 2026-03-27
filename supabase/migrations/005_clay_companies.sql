create table if not exists clay_companies (
  id          bigserial primary key,
  name        text not null,
  description text,
  industry    text,
  headcount   text,
  location    text,
  country     text,
  website     text,
  linkedin    text,
  search_vec  tsvector generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(industry, '') || ' ' ||
      coalesce(description, '')
    )
  ) stored
);

create index if not exists clay_companies_search_idx  on clay_companies using gin(search_vec);
create index if not exists clay_companies_industry_idx on clay_companies(industry);
create index if not exists clay_companies_name_idx     on clay_companies(name);

-- Public read, no writes from anon
alter table clay_companies enable row level security;
create policy "Public read" on clay_companies for select using (true);
