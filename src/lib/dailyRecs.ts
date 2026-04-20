import { supabase } from './supabase'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string

export interface RecCompany {
  name: string
  website: string
  linkedin: string | null
  industry: string
  stage: string
  tagline: string
  why_mucker: string
  founded: number | null
  location: string | null
}

// ─── Feedback types ───────────────────────────────────────────────────────────

/** 0 = Pass, 1 = Watch, 2 = Interested, 3 = Strong Yes */
export type FeedbackRating = 0 | 1 | 2 | 3

export const RATING_LABELS: Record<FeedbackRating, string> = {
  0: 'Pass',
  1: 'Watch',
  2: 'Interested',
  3: 'Strong Yes',
}

export const PASS_TAGS    = ['Wrong stage', 'Market too small', 'Too crowded', 'Poor traction', 'Wrong geography', 'Weak team signal']
export const POSITIVE_TAGS = ['Strong team', 'Interesting sector', 'Good timing', 'Clear moat', 'Novel approach', 'Strong traction', 'Unique market']

export interface FeedbackEntry {
  rating: FeedbackRating
  tags:   string[]
  note:   string
}

// ─── Weighted feedback profile ────────────────────────────────────────────────

// Rating weights — how much each level contributes to the preference signal.
// Pass = 0 (negative signal), Watch = 0.3 (weak positive), Interested = 0.7, Strong Yes = 1.0
const RATING_WEIGHT: Record<number, number> = { 0: 0, 1: 0.3, 2: 0.7, 3: 1.0 }
const NEGATIVE_WEIGHT: Record<number, number> = { 0: 1.0, 1: 0, 2: 0, 3: 0 }

// Preferences are only injected into the prompt once total confidence reaches this threshold.
// This prevents 1-2 early ratings from dominating all future picks.
const CONFIDENCE_THRESHOLD = 5

interface FeedbackProfile {
  preferenceBlock: string | null   // null until enough signal exists
  avoidBlock:      string | null
  recentlyRated:   string[]
  totalConfidence: number          // for diagnostics
}

async function buildFeedbackProfile(userId: string): Promise<FeedbackProfile> {
  const { data } = await supabase
    .from('rec_feedback')
    .select('rating, tags, note, company_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80)

  const rows = (data ?? []) as { rating: number; tags: string[]; note: string | null; company_data: RecCompany | null }[]

  // Build weighted frequency maps for industries and tags
  const posIndustry = new Map<string, number>()  // weighted sum of positive signal
  const negIndustry = new Map<string, number>()  // weighted sum of negative signal
  const posTags     = new Map<string, number>()
  const negTags     = new Map<string, number>()

  let totalPositiveWeight = 0
  let totalNegativeWeight = 0

  for (const row of rows) {
    const pw = RATING_WEIGHT[row.rating]   ?? 0
    const nw = NEGATIVE_WEIGHT[row.rating] ?? 0
    totalPositiveWeight += pw
    totalNegativeWeight += nw

    const d = row.company_data
    if (d?.industry) {
      const parts = d.industry.split(/[/,]+/).map(s => s.trim()).filter(Boolean)
      for (const p of parts) {
        posIndustry.set(p, (posIndustry.get(p) ?? 0) + pw)
        negIndustry.set(p, (negIndustry.get(p) ?? 0) + nw)
      }
    }

    for (const tag of (row.tags ?? [])) {
      if (pw > 0) posTags.set(tag, (posTags.get(tag) ?? 0) + pw)
      if (nw > 0) negTags.set(tag, (negTags.get(tag) ?? 0) + nw)
    }
  }

  const totalConfidence = totalPositiveWeight + totalNegativeWeight

  // Top industries/tags by weighted frequency — only those appearing multiple times
  const topPos = [...posIndustry.entries()]
    .filter(([, w]) => w >= 0.7)                  // at least one "Interested"-equivalent
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k]) => k)

  const topNeg = [...negIndustry.entries()]
    .filter(([, w]) => w >= 0.7)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k]) => k)

  const topPosTags = [...posTags.entries()]
    .filter(([, w]) => w >= 0.7)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([k]) => k)

  const topNegTags = [...negTags.entries()]
    .filter(([, w]) => w >= 0.7)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([k]) => k)

  // Only inject preferences once enough signal exists — avoids early-feedback bias
  const hasEnoughSignal = totalConfidence >= CONFIDENCE_THRESHOLD

  const preferenceBlock = hasEnoughSignal && (topPos.length > 0 || topPosTags.length > 0)
    ? [
        topPos.length     > 0 ? `Favour sectors: ${topPos.join(', ')}` : null,
        topPosTags.length > 0 ? `Signals that have resonated: ${topPosTags.join(', ')}` : null,
      ].filter(Boolean).join('\n')
    : null

  const avoidBlock = hasEnoughSignal && (topNeg.length > 0 || topNegTags.length > 0)
    ? [
        topNeg.length     > 0 ? `Avoid sectors: ${topNeg.join(', ')}` : null,
        topNegTags.length > 0 ? `Patterns to avoid: ${topNegTags.join(', ')}` : null,
      ].filter(Boolean).join('\n')
    : null

  const recentlyRated = rows
    .map(r => r.company_data?.name)
    .filter((n): n is string => !!n)
    .slice(0, 30)

  return { preferenceBlock, avoidBlock, recentlyRated, totalConfidence }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const SYSTEM = `You are a scout for Mucker Capital, an LA-based early-stage VC that leads pre-seed, seed, and Series A rounds. Your job is to discover 5 real, verifiable early-stage startups per day that strongly match Mucker's investment thesis.

Mucker's investment criteria:
- Stage: Pre-Seed, Seed, or Series A ONLY (never Series B+, never public companies)
- Problem: Urgent, frequent, expensive, and underserved — clear ICP with willingness to pay
- Market: Bottoms-up path to $1B+ exit. Multiple potential strategic acquirers.
- Competition: Non-crowded space OR "one-of-one" wedge that isn't easily replicated
- Traction: Early PMF signals — revenue, LOIs, waitlists, cohort retention, ≥2× YoY growth
- Moat: Network effect, data advantage, switching costs, or regulatory moat
- Sectors Mucker favors: B2B SaaS, vertical SaaS, fintech, marketplace, PropTech, HealthTech, EdTech, logistics, developer tools
- Team: Technical founders preferred; domain expertise required
- Geography: Primarily US, open to Latin America

You MUST use web search to find REAL companies with REAL websites. Do not invent companies.
For each company you must verify:
1. Their website actually exists and corresponds to the company name
2. The company is at the correct stage (pre-seed/seed/series A)
3. They have actual traction signals you can cite

Return ONLY a valid JSON array of exactly 5 companies. No markdown, no explanation. Begin with [ and end with ].

Each company object:
{
  "name": "Exact company name",
  "website": "https://full-url.com",
  "linkedin": "https://linkedin.com/company/slug or null",
  "industry": "Primary industry (e.g. B2B SaaS, FinTech, HealthTech)",
  "stage": "Seed",
  "tagline": "One sentence: what they do and for whom",
  "why_mucker": "2-3 sentences: specific reasons this fits Mucker criteria — cite real traction signals",
  "founded": 2022,
  "location": "City, State"
}`

function buildPrompt(profile: FeedbackProfile, todayStr: string): string {
  const avoid = profile.recentlyRated.length > 0
    ? `\n\nDo NOT recommend these companies (already rated): ${profile.recentlyRated.join(', ')}`
    : ''

  const prefSection = profile.preferenceBlock || profile.avoidBlock
    ? `\n\nPersonalisation signal (based on ${Math.round(profile.totalConfidence)} weighted ratings — apply as a gentle tilt, not a hard filter. Still prioritise fit with Mucker's core thesis above all):\n${[profile.preferenceBlock, profile.avoidBlock].filter(Boolean).join('\n')}`
    : `\n\n(No personalisation yet — prioritise diversity across sectors and stages.)`

  return `Date: ${todayStr}

Search the web for 5 real early-stage startups founded in the last 3 years that strongly match Mucker Capital's investment thesis. Prioritise companies with recent press coverage, new funding announcements, or product launches.${prefSection}${avoid}

Use web search to verify each company's website and traction before including them. Return the JSON array.`
}

// ─── Anthropic web-search call ────────────────────────────────────────────────

async function callWithWebSearch(prompt: string): Promise<RecCompany[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                                 API_KEY,
      'anthropic-version':                         '2023-06-01',
      'anthropic-beta':                            'web-search-2025-03-05',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type':                              'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 4000,
      system:     SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`)
  }

  const data = await res.json()
  const textBlock = [...(data.content ?? [])].reverse().find(
    (b: { type: string; text?: string }) => b.type === 'text' && b.text
  ) as { type: string; text: string } | undefined

  if (!textBlock?.text) throw new Error('No text in API response')

  const raw = textBlock.text
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error('No JSON array in response')

  return JSON.parse(raw.slice(start, end + 1)) as RecCompany[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getTodayRecs(userId: string): Promise<RecCompany[] | null> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('daily_recs')
    .select('companies')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  return data ? (data.companies as RecCompany[]) : null
}

export async function generateTodayRecs(userId: string): Promise<RecCompany[]> {
  const today   = new Date().toISOString().slice(0, 10)
  const profile = await buildFeedbackProfile(userId)
  const prompt  = buildPrompt(profile, today)
  const companies = await callWithWebSearch(prompt)

  await supabase.from('daily_recs').upsert(
    { user_id: userId, date: today, companies },
    { onConflict: 'user_id,date' }
  )

  return companies
}

export async function submitFeedback(
  userId: string,
  company: RecCompany,
  entry: FeedbackEntry,
): Promise<void> {
  await supabase.from('rec_feedback').upsert(
    {
      user_id:      userId,
      company_name: company.name,
      company_data: company,
      liked:        entry.rating >= 2,   // backcompat
      rating:       entry.rating,
      tags:         entry.tags,
      note:         entry.note || null,
    },
    { onConflict: 'user_id,company_name' }
  )
}

export async function getFeedbackMap(userId: string): Promise<Record<string, FeedbackEntry>> {
  const { data } = await supabase
    .from('rec_feedback')
    .select('company_name, rating, tags, note')
    .eq('user_id', userId)

  const map: Record<string, FeedbackEntry> = {}
  for (const row of data ?? []) {
    map[row.company_name] = {
      rating: (row.rating ?? 0) as FeedbackRating,
      tags:   row.tags ?? [],
      note:   row.note ?? '',
    }
  }
  return map
}
