import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { HarmonicClient } from './_lib/harmonic.js'
import { scoreCompany } from './_lib/scoring.js'
import { generateRationalesBatch } from './_lib/rationale.js'
import type { ProspectCompany } from './_lib/types.js'

const SUPABASE_URL         = process.env.SUPABASE_URL             ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const HARMONIC_API_KEY     = process.env.HARMONIC_API_KEY          ?? ''
const CRON_SECRET          = process.env.CRON_SECRET               ?? ''
const SAVED_SEARCH_IDS     = [
  parseInt(process.env.HARMONIC_DAILY_DISCOVERY_ID ?? '122197'),  // Mucker Base API Search
  parseInt(process.env.HARMONIC_SIGNALS_ID         ?? '171136'),  // Texas Pre-Seed/Seed Since 2020
]
const PUBLISH_LIMIT   = 10
const RATIONALE_LIMIT = 20
const CLAY_BATCH      = 80   // pulled + scored per run — small enough to fit in 60s

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
  return single ? parseInt(single[1]) : undefined
}

function clayToProspect(c: ClayRow): ProspectCompany {
  const raw     = c.website ?? ''
  const website = raw ? (raw.startsWith('http') ? raw : `https://${raw}`) : undefined
  const domain  = raw.replace(/^https?:\/\//, '').split('/')[0].toLowerCase() || undefined
  const loc     = [c.location, c.country].filter(Boolean).join(', ') || undefined
  return {
    name:          c.name,
    domain,
    website,
    description:   c.description  ?? undefined,
    sector:        c.industry     ?? undefined,
    location:      loc,
    employeeCount: parseHeadcount(c.headcount),
    investors:     [],
    founders:      [],
    rawSource:     { source: 'clay' },   // omit full clay row to keep payload small
  }
}

async function fetchClayCompanies(
  supabase: ReturnType<typeof createClient>,
  today: string,
): Promise<ProspectCompany[]> {
  const dateNum   = parseInt(today.replace(/-/g, ''), 10)
  const totalRows = 7800
  const offset    = dateNum % (totalRows - CLAY_BATCH)

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
  console.log(`Clay: ${data.length} companies at offset ${offset}`)
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
    .from('daily_picks').select('id').eq('pick_date', today).limit(1)
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
    .select('id').single()

  if (runErr || !runRow) {
    return res.status(500).json({ error: 'Failed to create run record', detail: runErr?.message })
  }
  const runId = runRow.id as string

  try {
    // ── 1. Source ─────────────────────────────────────────────────────────────
    let allCompanies: ProspectCompany[] = []

    if (useHarmonic) {
      const harmonic = new HarmonicClient(HARMONIC_API_KEY)
      for (const id of SAVED_SEARCH_IDS) {
        try {
          const cs = await harmonic.fetchSavedSearchCompanies(id)
          allCompanies.push(...cs)
          console.log(`Harmonic ${id}: ${cs.length}`)
        } catch (e) { console.error(`Harmonic ${id} failed:`, e) }
      }
    } else {
      allCompanies = await fetchClayCompanies(supabase, today)
    }

    if (allCompanies.length === 0) throw new Error(`No companies from ${source}`)

    // ── 2. Dedup by domain/name ───────────────────────────────────────────────
    const seen = new Map<string, ProspectCompany>()
    for (const c of allCompanies) {
      const key = (c.domain ?? c.name).toLowerCase()
      if (!seen.has(key)) seen.set(key, c)
    }
    const deduped = [...seen.values()]
    console.log(`Deduped: ${deduped.length}`)

    // ── 3. Score + sort ───────────────────────────────────────────────────────
    const scored = deduped
      .map(c => ({ company: c, score: scoreCompany(c) }))
      .sort((a, b) => b.score.combinedScore - a.score.combinedScore)

    // ── 4. Rationale for top N ────────────────────────────────────────────────
    const rationaleMap = await generateRationalesBatch(
      scored.slice(0, RATIONALE_LIMIT).map(({ company, score }) => ({ company, score }))
    )
    console.log(`Rationales: ${rationaleMap.size}`)

    // ── 5. Batch upsert companies ─────────────────────────────────────────────
    const companyRows = scored.map(({ company }) => ({
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
    }))

    // Upsert in chunks of 50 — conflict on name (works for both Clay and Harmonic)
    const CHUNK = 50
    const insertedCompanies: Array<{ id: string; name: string }> = []
    for (let i = 0; i < companyRows.length; i += CHUNK) {
      const chunk = companyRows.slice(i, i + CHUNK)
      const { data, error } = await supabase
        .from('prospecting_companies')
        .upsert(chunk, { onConflict: 'name', ignoreDuplicates: false })
        .select('id, name')
      if (error) console.error(`Company upsert chunk ${i} error:`, error.message)
      if (data) insertedCompanies.push(...(data as { id: string; name: string }[]))
    }

    // Build name → company_id map
    const companyIdMap = new Map<string, string>()
    for (const row of insertedCompanies) companyIdMap.set(row.name.toLowerCase(), row.id)

    // ── 6. Batch insert candidates ────────────────────────────────────────────
    const candidateRows = scored
      .map(({ company, score }) => {
        const companyId = companyIdMap.get(company.name.toLowerCase())
        if (!companyId) return null
        return {
          run_id:            runId,
          company_id:        companyId,
          mqs:               score.mqs,
          mus:               score.mus,
          combined_score:    score.combinedScore,
          recommendation:    score.recommendation,
          scoring_breakdown: { mqsFeatures: {}, musSignals: {} },
          rationale:         rationaleMap.get(company.name) ?? null,
          mucker_lens:       score.muckerLens,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    const { data: candData, error: candErr } = await supabase
      .from('prospecting_candidates')
      .insert(candidateRows)
      .select('id, company_id, combined_score, recommendation')

    if (candErr) throw new Error(`Candidate insert failed: ${candErr.message}`)

    // ── 7. Publish top picks ──────────────────────────────────────────────────
    const candidates = (candData ?? []) as Array<{
      id: string; company_id: string; combined_score: number; recommendation: string
    }>

    let publishable = candidates
      .filter(c => ['strong_pick', 'pick'].includes(c.recommendation))
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, PUBLISH_LIMIT)

    // Widen to 'watch' if not enough strong picks (common with Clay data)
    if (publishable.length < PUBLISH_LIMIT) {
      const publishedIds = new Set(publishable.map(p => p.id))
      const extra = candidates
        .filter(c => c.recommendation === 'watch' && !publishedIds.has(c.id))
        .sort((a, b) => b.combined_score - a.combined_score)
        .slice(0, PUBLISH_LIMIT - publishable.length)
      publishable = [...publishable, ...extra]
    }

    if (publishable.length > 0) {
      // Delete any existing picks for today (handles force reruns cleanly)
      await supabase.from('daily_picks').delete().eq('pick_date', today)

      const { error: pickErr } = await supabase.from('daily_picks').insert(
        publishable.map((c, idx) => ({
          candidate_id: c.id,
          run_id:       runId,
          company_id:   c.company_id,
          pick_date:    today,
          rank:         idx + 1,
          status:       'published',
        }))
      )
      if (pickErr) throw new Error(`daily_picks insert: ${pickErr.message ?? JSON.stringify(pickErr)}`)
    }

    // ── 8. Complete ───────────────────────────────────────────────────────────
    await supabase.from('prospecting_runs').update({
      status:        'completed',
      completed_at:  new Date().toISOString(),
      source_counts: { source, sourced: allCompanies.length, deduped: deduped.length, published: publishable.length },
    }).eq('id', runId)

    console.log(`Run ${runId} [${source}]: ${publishable.length} picks for ${today}`)
    return res.status(200).json({ runId, date: today, source, sourced: allCompanies.length, deduped: deduped.length, published: publishable.length })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Run failed:', msg)
    await supabase.from('prospecting_runs').update({ status: 'failed', error_summary: msg }).eq('id', runId)
    return res.status(500).json({ error: msg })
  }
}
