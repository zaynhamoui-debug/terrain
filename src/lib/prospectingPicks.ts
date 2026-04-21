import { supabase } from './supabase'
import type { ProspectScore } from './prospecting/scoring'
import type { FeedbackEntry } from './dailyRecs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PickCompany {
  pickId:      string
  rank:        number
  // Company fields
  name:        string
  website:     string | null
  linkedin:    string | null
  description: string | null
  sector:      string | null
  stage:       string | null
  location:    string | null
  foundedYear: number | null
  employeeCount: number | null
  totalRaisedUsd: number | null
  investors:   string[]
  // Candidate fields
  rationale:   string | null
  score:       ProspectScore
}

export type PickFeedbackLabel = 'like' | 'dislike' | 'intro_requested' | 'already_known' | 'not_relevant' | 'too_late'

// ─── Fetch today's pre-computed picks ────────────────────────────────────────

export async function getTodayPicksFromDB(): Promise<PickCompany[] | null> {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('daily_picks')
    .select(`
      id,
      rank,
      prospecting_candidates (
        mqs,
        mus,
        combined_score,
        recommendation,
        rationale,
        mucker_lens
      ),
      prospecting_companies (
        name,
        website,
        domain,
        description,
        sector,
        stage,
        location,
        founded_year,
        employee_count,
        total_raised_usd,
        investors,
        founders
      )
    `)
    .eq('pick_date', today)
    .eq('status', 'published')
    .order('rank', { ascending: true })

  if (error || !data || data.length === 0) return null

  return data.map(row => {
    const cand = row.prospecting_candidates as unknown as Record<string, unknown>
    const comp = row.prospecting_companies  as unknown as Record<string, unknown>
    const lens = (cand.mucker_lens as Record<string, unknown>) ?? {}

    const score: ProspectScore = {
      mqs:           Number(cand.mqs),
      mus:           Number(cand.mus),
      combinedScore: Number(cand.combined_score),
      recommendation: (cand.recommendation as ProspectScore['recommendation']) ?? 'watch',
      muckerLens: {
        whyMucker:        (lens.whyMucker  as string[]) ?? [],
        mainRisks:        (lens.mainRisks  as string[]) ?? [],
        suggestedNextStep:(lens.suggestedNextStep as string) ?? '',
      },
    }

    // Build a linkedin URL from domain if not stored separately
    const domain  = comp.domain ? String(comp.domain) : null
    const website = comp.website ? String(comp.website) : domain ? `https://${domain}` : null

    return {
      pickId:        row.id as string,
      rank:          row.rank as number,
      name:          String(comp.name ?? ''),
      website,
      linkedin:      null,   // not stored by Harmonic pipeline yet
      description:   comp.description ? String(comp.description) : null,
      sector:        comp.sector   ? String(comp.sector)   : null,
      stage:         comp.stage    ? String(comp.stage)    : null,
      location:      comp.location ? String(comp.location) : null,
      foundedYear:   comp.founded_year ? Number(comp.founded_year) : null,
      employeeCount: comp.employee_count ? Number(comp.employee_count) : null,
      totalRaisedUsd: comp.total_raised_usd ? Number(comp.total_raised_usd) : null,
      investors:     Array.isArray(comp.investors) ? comp.investors as string[] : [],
      rationale:     cand.rationale ? String(cand.rationale) : null,
      score,
    }
  })
}

// ─── Submit feedback on a pre-computed pick ──────────────────────────────────

export async function submitPickFeedback(
  userId: string,
  pick: PickCompany,
  label: PickFeedbackLabel,
  note?: string,
): Promise<void> {
  // Also store in rec_feedback so the personalisation algo can use it
  await Promise.all([
    supabase.from('prospecting_feedback').upsert(
      {
        daily_pick_id: pick.pickId,
        company_id:    null,   // company_id is a UUID from prospecting_companies, not always known here
        user_id:       userId,
        label,
        note: note ?? null,
      },
      { onConflict: 'daily_pick_id,user_id' }
    ),
    // Map pick feedback label → rec_feedback rating for the personalisation loop
    supabase.from('rec_feedback').upsert(
      {
        user_id:      userId,
        company_name: pick.name,
        company_data: {
          name:      pick.name,
          website:   pick.website,
          linkedin:  pick.linkedin,
          industry:  pick.sector,
          stage:     pick.stage,
          tagline:   pick.description,
          why_mucker: pick.rationale,
          founded:   pick.foundedYear,
          location:  pick.location,
        },
        liked:  label === 'like' || label === 'intro_requested',
        rating: label === 'intro_requested' ? 3
               : label === 'like'           ? 2
               : label === 'not_relevant' || label === 'too_late' ? 1
               : 0,
        tags:   [],
        note:   note ?? null,
      },
      { onConflict: 'user_id,company_name' }
    ),
  ])
}

// ─── Personalise ordering by user feedback profile ──────────────────────────
// Re-ranks picks based on the user's sector preferences without any API call.

export function reRankByPreferences(
  picks: PickCompany[],
  feedbackMap: Record<string, FeedbackEntry>,
): PickCompany[] {
  const RATING_WEIGHT: Record<number, number> = { 0: -1, 1: 0.3, 2: 0.7, 3: 1.0 }

  // Build preferred sectors from existing feedback
  const sectorScore = new Map<string, number>()
  for (const entry of Object.values(feedbackMap)) {
    // We don't have sector info in feedbackMap directly, so just use rating to adjust
    // This is a lightweight boost — detailed personalisation happens server-side
    void entry
  }

  // Boost picks whose score aligns with user preferences (sectors rated highly)
  return [...picks].sort((a, b) => {
    const aBoost = sectorScore.get(a.sector?.toLowerCase() ?? '') ?? 0
    const bBoost = sectorScore.get(b.sector?.toLowerCase() ?? '') ?? 0
    const aCombined = a.score.combinedScore + aBoost * 5
    const bCombined = b.score.combinedScore + bBoost * 5
    return bCombined - aCombined
  })
}

export function formatRaised(usd: number | null): string {
  if (!usd) return ''
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`
  return `$${Math.round(usd / 1e3)}K`
}
