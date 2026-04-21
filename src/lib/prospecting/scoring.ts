import type { RecCompany } from '../dailyRecs'
import type { Company } from '../../types/marketMap'

export type Recommendation = 'strong_pick' | 'pick' | 'watch' | 'pass'

export interface ProspectScore {
  mqs: number
  mus: number
  combinedScore: number
  recommendation: Recommendation
  muckerLens: {
    whyMucker: string[]
    mainRisks: string[]
    suggestedNextStep: string
  }
}

const HOT_GEOS = ['san francisco', 'sf bay', 'bay area', 'palo alto', 'menlo park', 'seattle', 'new york']
const HYPE_VERTICALS = ['ai agent', 'foundation model', 'crypto', 'web3', 'defense', 'space', 'robotics']
const TIER_1_INVESTORS = ['sequoia', 'a16z', 'andreessen', 'benchmark', 'accel', 'greylock', 'lightspeed']

function clamp(v: number) { return Math.max(0, Math.min(100, Math.round(v))) }
function has(text: string | undefined, terms: string[]) {
  const s = (text ?? '').toLowerCase()
  return terms.some(t => s.includes(t))
}

function recommendationFor(mqs: number, mus: number, combined: number): Recommendation {
  if (mqs < 50 || mus < 50) return 'pass'
  if (combined >= 70) return 'strong_pick'
  if (combined >= 55) return 'pick'
  if (combined >= 45) return 'watch'
  return 'pass'
}

export function scoreCompany(company: RecCompany): ProspectScore {
  const stage = (company.stage ?? '').toLowerCase().replace(/[_-]/g, ' ')
  const desc  = `${company.tagline ?? ''} ${company.why_mucker ?? ''}`.trim()
  const loc   = (company.location ?? '').toLowerCase()

  const mqsFeatures: Record<string, number> = {
    stage_fit:            stage.includes('pre seed') || stage.includes('seed') || stage.includes('series a') ? 15 : 6,
    software_driven:      /software|platform|workflow|automation|api|saas|data|operating system/i.test(desc) ? 8 : 2,
    icp_clarity:          /for |helps |enables |serves |operators|teams|clinics|brands|contractors/i.test(desc) ? 5 : 2,
    defensibility_hint:   /data|network|workflow|compliance|integration|system of record/i.test(desc) ? 5 : 2,
    traction_signal:      /revenue|growth|customers|mrr|arr|pmf|retention|waitlist|loi/i.test(desc) ? 8 : 2,
    product_live:         /customer|used by|platform|product|launched|live/i.test(desc) ? 6 : 3,
    market_size:          /\$\d+[bm]|billion|marketplace|national|global|across/i.test(desc) ? 5 : 3,
    mucker_sector:        /b2b|saas|fintech|proptech|healthtech|edtech|logistics|developer/i.test(desc) ? 8 : 2,
    geographic_tam:       /global|national|across|marketplace|platform/i.test(desc) ? 5 : 3,
    moat_signal:          /network effect|data advantage|switching cost|regulatory|patent/i.test(desc) ? 6 : 2,
  }

  const mqs = clamp(Object.values(mqsFeatures).reduce((s, v) => s + v, 0))

  const musSignals: Record<string, number> = {
    base:              70,
    non_obvious_geo:   has(loc, HOT_GEOS)  ? -10 :  8,
    boring_vertical:   /logistics|compliance|health|construction|manufacturing|field|regulatory|insurance/i.test(desc) ? 7 : 0,
    hype_vertical:     has(desc, HYPE_VERTICALS) ? -8 : 0,
    tier1_vc:          has(desc, TIER_1_INVESTORS) ? -20 : 0,
  }

  const mus      = clamp(Object.values(musSignals).reduce((s, v) => s + v, 0))
  const combined = Math.round((mqs * mus) / 100)
  const rec      = recommendationFor(mqs, mus, combined)

  // Build why/risks from actual data
  const whyMucker: string[] = []
  if (mqsFeatures.stage_fit === 15)       whyMucker.push('Right stage: pre-seed or seed.')
  if (mqsFeatures.traction_signal === 8)  whyMucker.push('Has clear traction signals.')
  if (mqsFeatures.software_driven === 8)  whyMucker.push('Software-driven with scalable margins.')
  if (mqsFeatures.defensibility_hint === 5) whyMucker.push('Defensibility signals present.')
  if (mqsFeatures.mucker_sector === 8)    whyMucker.push('Fits a sector Mucker actively backs.')
  if (musSignals.non_obvious_geo === 8)   whyMucker.push('Non-obvious geography — less VC competition.')
  if (musSignals.boring_vertical === 7)   whyMucker.push('Unglamorous vertical often overlooked by top-tier VCs.')
  if (whyMucker.length === 0)             whyMucker.push('Requires deeper human review for Mucker fit.')

  const mainRisks: string[] = []
  if (mqsFeatures.traction_signal < 8)   mainRisks.push('Traction signals unclear — verify PMF before engaging.')
  if (mqsFeatures.icp_clarity < 5)       mainRisks.push('ICP not fully defined in available description.')
  if (musSignals.hype_vertical === -8)    mainRisks.push('Operates in a hyped vertical; expect crowded cap table.')
  if (musSignals.non_obvious_geo === -10) mainRisks.push('Hot geography — competitive deal flow likely.')
  if (mainRisks.length === 0)            mainRisks.push('No structural red flags found; do standard diligence.')

  const suggestedNextStep = rec === 'pass'
    ? 'Do not prioritize unless new evidence appears.'
    : rec === 'strong_pick'
    ? "Fast-track: identify a warm intro path and review the founder's background today."
    : rec === 'pick'
    ? 'Review founder backgrounds and reach out within the week.'
    : 'Add to watch list and revisit in 30 days for updated traction signals.'

  return { mqs, mus, combinedScore: combined, recommendation: rec, muckerLens: { whyMucker, mainRisks, suggestedNextStep } }
}

// ─── Market-map Company scoring ───────────────────────────────────────────────
// Maps the richer Company type (from the market map) into the same scoring logic.

export function scoreMarketCompany(company: Company): ProspectScore {
  const desc = `${company.tagline ?? ''} ${company.differentiator ?? ''}`.trim()

  const totalRaisedUsd = (() => {
    const m = company.funding_display?.match(/\$([\d.]+)(M|B|K)?/i)
    if (!m) return 0
    const n = parseFloat(m[1])
    const unit = (m[2] ?? '').toUpperCase()
    return unit === 'B' ? n * 1e9 : unit === 'K' ? n * 1e3 : n * 1e6
  })()

  const employeeCount = (() => {
    const m = company.headcount_range?.match(/(\d[\d,]*)/)
    return m ? parseInt(m[1].replace(/,/g, '')) : 0
  })()

  // Use RecCompany-compatible shape and delegate to scoreCompany
  const proxy: RecCompany = {
    name:       company.name,
    website:    company.website,
    linkedin:   company.linkedin,
    industry:   company.momentum_signal ?? '',
    stage:      company.stage,
    tagline:    company.tagline ?? '',
    why_mucker: desc,
    founded:    company.founded ?? null,
    location:   company.hq ?? null,
  }

  const base = scoreCompany(proxy)

  // Supplement MQS with data only available on Company (funding, headcount)
  let mqsAdj = 0
  if (totalRaisedUsd > 0 && totalRaisedUsd <= 3_500_000)   mqsAdj += 5   // capital efficient
  if (employeeCount >= 2 && employeeCount <= 30)            mqsAdj += 4   // right team size
  if (company.momentum_signal?.includes('Hypergrowth'))     mqsAdj += 5   // clear momentum
  if (company.investors && company.investors.length > 0)    mqsAdj += 3   // backed

  let musAdj = 0
  if (totalRaisedUsd > 10_000_000)                          musAdj -= 10  // over-funded
  if (company.investors?.some(i => TIER_1_INVESTORS.some(t => i.toLowerCase().includes(t)))) musAdj -= 20

  const mqs      = clamp(base.mqs + mqsAdj)
  const mus      = clamp(base.mus + musAdj)
  const combined = Math.round((mqs * mus) / 100)
  const rec      = recommendationFor(mqs, mus, combined)

  // Enrich why/risks with market-map-specific signals
  const whyMucker = [...base.muckerLens.whyMucker]
  const mainRisks = [...base.muckerLens.mainRisks]

  if (mqsAdj >= 5 && !whyMucker.some(w => w.includes('capital')))
    whyMucker.push('Capital-efficient with room for Mucker to lead.')
  if (musAdj <= -20)
    mainRisks.push('Tier-1 VC on cap table — Mucker may be crowded out.')
  if (totalRaisedUsd > 10_000_000)
    mainRisks.push('Already raised >$10M; may be too late for seed-stage entry.')

  const suggestedNextStep = rec === 'pass'
    ? 'Do not prioritize unless new evidence appears.'
    : rec === 'strong_pick'
    ? "Fast-track: identify a warm intro path and review the founder's background today."
    : rec === 'pick'
    ? 'Review founder backgrounds and reach out within the week.'
    : 'Add to watch list and revisit in 30 days for updated traction signals.'

  return { mqs, mus, combinedScore: combined, recommendation: rec, muckerLens: { whyMucker, mainRisks, suggestedNextStep } }
}
