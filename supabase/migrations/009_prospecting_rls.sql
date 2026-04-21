alter table public.prospecting_runs enable row level security;
alter table public.prospecting_companies enable row level security;
alter table public.prospecting_candidates enable row level security;
alter table public.daily_picks enable row level security;
alter table public.prospecting_feedback enable row level security;
alter table public.prospecting_scoring_configs enable row level security;

create policy "authenticated users can read prospecting runs"
  on public.prospecting_runs for select
  to authenticated
  using (true);

create policy "authenticated users can read prospecting companies"
  on public.prospecting_companies for select
  to authenticated
  using (true);

create policy "authenticated users can read prospecting candidates"
  on public.prospecting_candidates for select
  to authenticated
  using (true);

create policy "authenticated users can read published daily picks"
  on public.daily_picks for select
  to authenticated
  using (status = 'published');

create policy "authenticated users can create feedback"
  on public.prospecting_feedback for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "authenticated users can read own feedback"
  on public.prospecting_feedback for select
  to authenticated
  using (auth.uid() = user_id);

create policy "authenticated users can read active scoring config"
  on public.prospecting_scoring_configs for select
  to authenticated
  using (is_active = true);

-- Server-side jobs should use the Supabase service-role key, which bypasses RLS.

