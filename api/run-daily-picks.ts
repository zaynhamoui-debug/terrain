import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { HarmonicClient } from './_lib/harmonic'
import { scoreCompany } from './_lib/scoring'
import { generateRationalesBatch } from './_lib/rationale'
import type { ProspectCompany } from './_lib/types'

const SUPABASE_URL         = process.env.SUPABASE_URL             ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const HARMONIC_API_KEY     = process.env.HARMONIC_API_KEY          ?? ''
const CRON_SECRET          = process.env.CRON_SECRET               ?? ''
const SAVED_SEARCH_IDS     = [
  parseInt(process.env.HARMONIC_DAILY_DISCOVERY_ID ?? '172255'),
  parseInt(process.env.HARMONIC_SIGNALS_ID         ?? '172257'),
]
const PUBLISH_LIMIT   = 10
const RATIONALE_LIMIT = 20
const CLAY_BATCH      = 300   // how many Clay companies to pull and score per run

// ─── Clay helpers ─────────────────────────────────────────────────────────────

interface ClayRow {
  name:        string
  description: string | null
  industry:    string | null
  headcount:   string | null
  location:    string | null
  country:     string | null
  website:     string | null
}

function parseHeadcount(h: string | null): number | undefined {
  if (!h) return undefined
  const range = h.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2)
  const single = h.match(/(\d+)\+?/)
  if (single) return parseInt(single[1])
  return undefined
}

function clayToProspect(c: ClayRow): ProspectCompany {
  const raw     = c.website ?? ''
  const website = raw ? (raw.startsWith('http') ? raw : `https://${raw}`) : undefined
  const domain  = raw.replace(/^https?:\/\//, '').split('/')[0] || undefined
  const loc     = [c.location, c.country].filter(Boolean).join(', ') || undefined
  return {
    name:         c.name,
    domain,
    website,
    description:  c.description  ?? undefined,
    sector:       c.industry     ?? undefined,
    location:     loc,
    employeeCount: parseHeadcount(c.headcount),
    investors:    [],
    founders:     [],
    rawSource:    { source: 'clay', clay: c },
  }
}

// Rotate through the Clay DB using today's date as an offset seed
async function fetchClayCompanies(
  supabase: ReturnType<typeof createClient>,
  today: string,
): Promise<ProspectCompany[]> {
  const dateNum = parseInt(today.replace(/-/g, ''), 10)
  const totalRows = 8000
  const offset = dateNum % (totalRows - CLAY_BATCH)

  const { data, error } = await supabase
    .from('clay_companies')
    .select('name, description, industry, headcount, location, country, website')
    .not('website', 'is', null)
    .not('description', 'is', null)
    .range(offset, offset + CLAY_BATCH - 1)

  if (error || !data) {
    console.error('Clay fetch error:', error?.message)
    return []
  }

  console.log(`Clay: fetched ${data.length} companies (offset ${offset})`)
  return (data as ClayRow[]).map(clayToProspect)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization ?? ''
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env vars' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const today    = new Date().toISOString().slice(0, 10)

  // Idempotency
  const { data: existing } = await supabase
    .from('daily_picks')
    .select('id')
    .eq('pick_date', today)
    .limit(1)

  if (existing && existing.length > 0 && req.query.force !== '1') {
    return res.status(200).json({ message: `Picks already published for ${today}`, skipped: true })
  }

  const useHarmonic = !!HARMONIC_API_KEY
  const source      = useHarmonic ? 'harmonic' : 'clay'

  const { data: runRow, error: runErr } = await supabase
    .from('prospecting_runs')
    .insert({
      run_date:                  today,
      status:                    'started',
      scoring_version:           'heuristic-v1',
      harmonic_saved_search_ids: useHarmonic ? SAVED_SEARCH_IDS : [],
    })
    .select('id')
    .single()

  if (runErr || !runRow) {
    return res.status(500).json({ error: 'Failed to create run record', detail: runErr?.message })
  }

  const runId = runRow.id as string

  try {
    // ── Source companies ──────────────────────────────────────────────────────
    let sourced: Array<{ savedSearchId: number; company: ProspectCompany }> = []

    if (useHarmonic) {
      const harmonic = new HarmonicClient(HARMONIC_API_KEY)
      for (const savedSearchId of SAVED_SEARCH_IDS) {
        try {
          const companies = await harmonic.fetchSavedSearchCompanies(savedSearchId)
          sourced.push(...companies.map(company => ({ savedSearchId, company })))
          console.log(`Harmonic search ${savedSearchId}: ${companies.length} companies`)
        } catch (err) {
          console.error(`Harmonic search ${savedSearchId} failed:`, err)
        }
      }
    } else {
      const clayCompanies = await fetchClayCompanies(supabase, today)
      sourced = clayCompanies.map(company => ({ savedSearchId: 0, company }))
      console.log(`Clay source: ${sourced.length} companies`)
    }

    if (sourced.length === 0) {
      throw new Error(`No companies returned from ${source}.`)
    }

    // ── Deduplicate ───────────────────────────────────────────────────────────
    const seen = new Map<string, { savedSearchId: number; company: ProspectCompany }>()
    for (const item of sourced) {
      const key = (item.company.domain ?? item.company.name).toLowerCase()
      if (!seen.has(key)) seen.set(key, item)
    }
    const deduped = [...seen.values()]
    console.log(`After dedup: ${deduped.length} unique companies`)

    // ── Score ─────────────────────────────────────────────────────────────────
    const scored = deduped
      .map(({ savedSearchId, company }) => ({ savedSearchId, company, score: scoreCompany(company) }))
      .sort((a, b) => b.score.combinedScore - a.score.combinedScore)

    // ── Generate rationale for top N ──────────────────────────────────────────
    const topForRationale = scored.slice(0, RATIONALE_LIMIT)
    const rationaleMap    = await generateRationalesBatch(
      topForRationale.map(({ company, score }) => ({ company, score }))
    )
    console.log(`Generated rationale for ${rationaleMap.size} companies`)

    // ── Upsert companies + candidates ─────────────────────────────────────────
    interface Candidate { id: string; companyId: string; combinedScore: number; recommendation: string }
    const candidates: Candidate[] = []

    for (const { savedSearchId, company, score } of scored) {
      const conflictCol = company.domain ? 'domain' : 'harmonic_id'

      const { data: compRow, error: compErr } = await supabase
        .from('prospecting_companies')
        .upsert(
          {
            harmonic_id:           company.harmonicId        || null,
            name:                  company.name,
            domain:                company.domain            || null,
            website:               company.website           || null,
            description:           company.description       || null,
            sector:                company.sector            || null,
            stage:                 company.stage             || null,
            location:              company.location          || null,
            founded_year:          company.foundedYear       || null,
            employee_count:        company.employeeCount     || null,
            employee_growth_3m:    company.employeeGrowth3m  || null,
            total_raised_usd:      company.totalRaisedUsd    || null,
            last_round_amount_usd: company.lastRoundAmountUsd || null,
            last_round_date:       company.lastRoundDate     || null,
            investors:             company.investors         ?? [],
            founders:              company.founders          ?? [],
            raw_source:            company.rawSource         ?? {},
            updated_at:            new Date().toISOString(),
          },
          { onConflict: conflictCol, ignoreDuplicates: false }
        )
        .select('id')
        .single()

      if (compErr || !compRow) {
        console.error(`Failed to upsert company ${company.name}:`, compErr?.message)
        continue
      }

      const { data: candRow, error: candErr } = await supabase
        .from('prospecting_candidates')
        .insert({
          run_id:                 runId,
          company_id:             compRow.id,
          source_saved_search_id: savedSearchId || null,
          mqs:                    score.mqs,
          mus:                    score.mus,
          combined_score:         score.combinedScore,
          recommendation:         score.recommendation,
          scoring_breakdown:      { mqsFeatures: {}, musSignals: {} },
          rationale:              rationaleMap.get(company.name) ?? null,
          mucker_lens:            score.muckerLens,
        })
        .select('id, company_id, combined_score, recommendation')
        .single()

      if (candErr || !candRow) {
        console.error(`Failed to insert candidate for ${company.name}:`, candErr?.message)
        continue
      }

      candidates.push({
        id:             candRow.id as string,
        companyId:      candRow.company_id as string,
        combinedScore:  candRow.combined_score as number,
        recommendation: candRow.recommendation as string,
      })
    }

    // ── Publish top picks ─────────────────────────────────────────────────────
    const publishable = candidates
      .filter(c => ['strong_pick', 'pick'].includes(c.recommendation))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, PUBLISH_LIMIT)

    // Widen to 'watch' if not enough strong picks from Clay data
    if (publishable.length < PUBLISH_LIMIT) {
      const extra = candidates
        .filter(c => c.recommendation === 'watch' && !publishable.find(p => p.id === c.id))
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, PUBLISH_LIMIT - publishable.length)
      publishable.push(...extra)
    }

    if (publishable.length > 0) {
      await supabase
        .from('daily_picks')
        .update({ status: 'archived' })
        .eq('pick_date', today)

      const pickRows = publishable.map((c, idx) => ({
        candidate_id: c.id,
        run_id:       runId,
        company_id:   c.companyId,
        pick_date:    today,
        rank:         idx + 1,
        status:       'published',
      }))

      const { error: pickErr } = await supabase.from('daily_picks').insert(pickRows)
      if (pickErr) throw pickErr
    }

    // ── Complete run ──────────────────────────────────────────────────────────
    await supabase
      .from('prospecting_runs')
      .update({
        status:        'completed',
        completed_at:  new Date().toISOString(),
        source_counts: { source, sourced: sourced.length, deduped: deduped.length, scored: scored.length, published: publishable.length },
      })
      .eq('id', runId)

    console.log(`Run ${runId} complete [${source}]: ${publishable.length} picks published for ${today}`)

    return res.status(200).json({ runId, date: today, source, sourced: sourced.length, deduped: deduped.length, published: publishable.length })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Daily picks run failed:', msg)
    await supabase.from('prospecting_runs').update({ status: 'failed', error_summary: msg }).eq('id', runId)
    return res.status(500).json({ error: msg })
  }
}
