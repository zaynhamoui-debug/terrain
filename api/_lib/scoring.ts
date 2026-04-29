import type { ProspectCompany, ProspectScore, Recommendation } from './types.js'

const HOT_GEOS        = ['san francisco', 'sf bay', 'bay area', 'palo alto', 'menlo park', 'seattle', 'new york']
const HYPE_VERTICALS  = ['ai agent', 'foundation model', 'crypto', 'web3', 'defense', 'space', 'robotics']
const TIER_1_INVESTORS = ['sequoia', 'a16z', 'andreessen', 'benchmark', 'accel', 'greylock', 'lightspeed']

function clamp(v: number) { return Math.max(0, Math.min(100, Math.round(v))) }
function has(text: string | undefined, terms: string[]) {
  const s = (text ?? '').toLowerCase()
  return terms.some(t => s.includes(t))
}

function normalizeStage(stage?: string) {
  return (stage ?? '').toLowerCase().replace(/[_-]/g, ' ')
}

function recommendation(mqs: number, mus: number, combined: number): Recommendation {
  if (mqs < 50 || mus < 50) return 'pass'
  if (combined >= 70) return 'strong_pick'
  if (combined >= 55) return 'pick'
  if (combined >= 45) return 'watch'
  return 'pass'
}

export function scoreCompany(company: ProspectCompany): ProspectScore {
  const stage       = normalizeStage(company.stage)
  const desc        = company.description ?? ''
  const loc         = (company.location ?? '').toLowerCase()
  const investors   = company.investors ?? []
  const headcount   = company.employeeCount ?? 0
  const growth      = company.employeeGrowth3m ?? 0
  const totalRaised = company.totalRaisedUsd ?? 0
  const lastRound   = company.lastRoundAmountUsd ?? 0

  const mqsFeatures: Record<string, number> = {
    stage_fit:               stage.includes('pre seed') || stage.includes('seed') || stage.includes('series a') ? 15 : 6,
    team_size_fit:           headcount >= 2 && headcount <= 30 ? 8 : headcount <= 60 ? 5 : 1,
    founder_domain_operator: (company.founders ?? []).some(f => /founder|operator|head|vp|director/i.test(f.background ?? '')) ? 12 : 5,
    founder_technical:       (company.founders ?? []).some(f => /engineer|technical|cto|product|data/i.test(`${f.title ?? ''} ${f.background ?? ''}`)) ? 8 : 3,
    headcount_growth:        growth >= 20 ? 5 : growth > 0 ? 3 : 1,
    recent_key_hire:         growth >= 20 ? 6 : 2,
    fundraise_window:        totalRaised <= 3_500_000 || lastRound <= 3_000_000 ? 8 : 3,
    software_driven:         /software|platform|workflow|automation|api|saas|data|operating system/i.test(desc) ? 8 : 2,
    gross_margin_proxy:      /software|saas|marketplace|data/i.test(desc) ? 2 : 1,
    capital_efficiency:      totalRaised > 0 && totalRaised <= 3_500_000 ? 7 : 3,
    product_live:            /customer|used by|platform|product|launched|live/i.test(desc) ? 6 : 3,
    icp_clarity:             /for |helps |enables |serves |operators|teams|clinics|brands|contractors/i.test(desc) ? 5 : 2,
    defensibility:           /data|network|workflow|compliance|integration|system of record/i.test(desc) ? 5 : 2,
    geographic_tam:          /global|national|across|marketplace|platform/i.test(desc) ? 5 : 3,
  }

  const mqs = clamp(Object.values(mqsFeatures).reduce((s, v) => s + v, 0))

  const musSignals: Record<string, number> = {
    base:                 70,
    quiet_builder:        totalRaised <= 3_500_000 ? 8 : 0,
    non_obvious_geo:      has(loc, HOT_GEOS) ? -10 : 8,
    boring_vertical:      /logistics|compliance|health|construction|manufacturing|field|regulatory|insurance/i.test(desc) ? 7 : 0,
    operator_founder:     mqsFeatures.founder_domain_operator >= 10 ? 5 : 0,
    tier1_vc:             investors.some(i => has(i, TIER_1_INVESTORS)) ? -20 : 0,
    hype_vertical:        has(desc, HYPE_VERTICALS) ? -8 : 0,
    funding_velocity:     totalRaised > 10_000_000 || lastRound > 5_000_000 ? -15 : 0,
  }

  const mus      = clamp(Object.values(musSignals).reduce((s, v) => s + v, 0))
  const combined = Math.round((mqs * mus) / 100)
  const rec      = recommendation(mqs, mus, combined)

  const whyMucker: string[] = []
  if (mqsFeatures.stage_fit === 15)              whyMucker.push('Right stage for Mucker (pre-seed or seed).')
  if (mqsFeatures.software_driven === 8)         whyMucker.push('Software-driven model with scalable margins.')
  if (mqsFeatures.capital_efficiency === 7)      whyMucker.push('Capital-efficient — room for Mucker to lead.')
  if (mqsFeatures.defensibility === 5)           whyMucker.push('Defensibility signals in product or data.')
  if (mqsFeatures.founder_domain_operator >= 10) whyMucker.push('Operator-founder with domain expertise.')
  if (musSignals.non_obvious_geo === 8)          whyMucker.push('Non-obvious geography — less VC competition.')
  if (musSignals.boring_vertical === 7)          whyMucker.push('Unglamorous vertical often overlooked by top-tier VCs.')
  if (whyMucker.length === 0)                    whyMucker.push('Requires deeper human review for Mucker fit.')

  const mainRisks: string[] = []
  if (mqsFeatures.product_live < 6)             mainRisks.push('Product launch status unclear — verify traction.')
  if (mqsFeatures.icp_clarity < 5)              mainRisks.push('ICP not fully defined.')
  if (musSignals.hype_vertical === -8)           mainRisks.push('Operates in a hyped vertical.')
  if (musSignals.non_obvious_geo === -10)        mainRisks.push('Hot geography — competitive deal flow likely.')
  if (musSignals.tier1_vc === -20)               mainRisks.push('Tier-1 VC on cap table — Mucker may be crowded out.')
  if (musSignals.funding_velocity === -15)       mainRisks.push('Already raised >$10M — may be too late for seed entry.')
  if (mainRisks.length === 0)                    mainRisks.push('No structural red flags — do standard diligence.')

  const suggestedNextStep = rec === 'pass'
    ? 'Do not prioritize unless new evidence appears.'
    : rec === 'strong_pick'
    ? "Fast-track: identify a warm intro path and review the founder's background today."
    : rec === 'pick'
    ? 'Review founder backgrounds and reach out within the week.'
    : 'Add to watch list and revisit in 30 days.'

  return { mqs, mus, combinedScore: combined, recommendation: rec, muckerLens: { whyMucker, mainRisks, suggestedNextStep } }
}
