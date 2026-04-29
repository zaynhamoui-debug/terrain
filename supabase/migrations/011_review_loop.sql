-- ─── 1a. Structured notes on prospecting_feedback ──────────────────────────
alter table public.prospecting_feedback
  add column if not exists structured_notes jsonb;

-- ─── 1b. Scoring recalibration log ──────────────────────────────────────────
create table if not exists public.scoring_recalibration_log (
  id                uuid primary key default gen_random_uuid(),
  triggered_at      timestamptz not null default now(),
  feedback_count    integer not null,
  previous_version  text,
  new_version       text not null,
  weight_changes    jsonb not null default '{}'::jsonb
);

-- ─── 1c. Review status view ──────────────────────────────────────────────────
create or replace view public.prospecting_review_status as
select
  pc.id,
  pc.name,
  pc.sector,
  pc.stage,
  count(pf.id)                    as review_count,
  count(distinct pf.user_id)      as reviewer_count,
  array_agg(distinct pf.label)    as labels,
  max(pf.created_at)              as last_reviewed_at,
  min(dp.pick_date)               as first_shown_date
from public.prospecting_companies pc
left join public.daily_picks dp
  on dp.company_id = pc.id
  and dp.status = 'published'
left join public.prospecting_feedback pf
  on pf.daily_pick_id = dp.id
group by pc.id, pc.name, pc.sector, pc.stage;

-- ─── 1d. RLS ─────────────────────────────────────────────────────────────────
alter table public.scoring_recalibration_log enable row level security;

-- Authenticated users can read
create policy "authenticated can read recalibration log"
  on public.scoring_recalibration_log
  for select
  to authenticated
  using (true);

-- Only service role can insert (service role bypasses RLS by default)
-- So no explicit write policy is needed for service role

-- Grant read on the view to authenticated users
grant select on public.prospecting_review_status to authenticated;
