create extension if not exists "pgcrypto";

create table if not exists public.prospecting_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  scoring_version text not null default 'heuristic-v1',
  harmonic_saved_search_ids integer[] not null default array[172255, 172257],
  source_counts jsonb not null default '{}'::jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.prospecting_companies (
  id uuid primary key default gen_random_uuid(),
  harmonic_id text unique,
  name text not null,
  domain text unique,
  website text,
  description text,
  sector text,
  stage text,
  location text,
  founded_year integer,
  employee_count integer,
  employee_growth_3m numeric,
  total_raised_usd numeric,
  last_round_amount_usd numeric,
  last_round_date date,
  investors text[] not null default '{}',
  founders jsonb not null default '[]'::jsonb,
  raw_source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospecting_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.prospecting_runs(id) on delete cascade,
  company_id uuid not null references public.prospecting_companies(id) on delete cascade,
  source_saved_search_id integer,
  mqs integer not null check (mqs between 0 and 100),
  mus integer not null check (mus between 0 and 100),
  combined_score numeric not null,
  recommendation text not null check (recommendation in ('strong_pick', 'pick', 'watch', 'pass')),
  scoring_breakdown jsonb not null default '{}'::jsonb,
  rationale text,
  mucker_lens jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, company_id)
);

create table if not exists public.daily_picks (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.prospecting_candidates(id) on delete cascade,
  run_id uuid not null references public.prospecting_runs(id) on delete cascade,
  company_id uuid not null references public.prospecting_companies(id) on delete cascade,
  pick_date date not null,
  rank integer not null,
  status text not null default 'published' check (status in ('draft', 'published', 'suppressed', 'archived')),
  editor_note text,
  created_at timestamptz not null default now(),
  unique (pick_date, company_id)
);

create table if not exists public.prospecting_feedback (
  id uuid primary key default gen_random_uuid(),
  daily_pick_id uuid references public.daily_picks(id) on delete set null,
  candidate_id uuid references public.prospecting_candidates(id) on delete set null,
  company_id uuid references public.prospecting_companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  label text not null check (label in ('like', 'dislike', 'intro_requested', 'already_known', 'not_relevant', 'too_late', 'bad_data')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.prospecting_scoring_configs (
  version text primary key,
  config jsonb not null,
  rubric_markdown text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists prospecting_runs_run_date_idx on public.prospecting_runs(run_date desc);
create index if not exists prospecting_candidates_score_idx on public.prospecting_candidates(run_id, combined_score desc);
create index if not exists daily_picks_date_rank_idx on public.daily_picks(pick_date desc, rank asc);
create index if not exists prospecting_feedback_company_idx on public.prospecting_feedback(company_id, created_at desc);
