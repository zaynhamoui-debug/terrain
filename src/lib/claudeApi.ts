import { MarketMap, Company } from '../types/marketMap'
import { supabase } from './supabase'

const API_KEY    = import.meta.env.VITE_ANTHROPIC_API_KEY as string
const MODEL_FAST = 'claude-haiku-4-5-20251001'

interface TextBlock   { type: 'text'; text: string }
interface ApiResponse { content: { type: string; text?: string }[] }

interface ClayCompany {
  name: string
  description: string | null
  industry: string | null
  headcount: string | null
  location: string | null
  country: string | null
  website: string | null
  linkedin: string | null
}

async function callHaiku(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                                 API_KEY,
      'anthropic-version':                         '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type':                              'application/json',
    },
    body: JSON.stringify({
      model:      MODEL_FAST,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`
    )
  }

  const data: ApiResponse = await res.json()
  const block = data.content.find((b): b is TextBlock => b.type === 'text')
  if (!block?.text) throw new Error('No text in API response')
  return block.text
}

// ─── Search real companies from Clay database ─────────────────────────────────

async function searchClayCompanies(query: string, limit = 40, excludeNames: string[] = []): Promise<ClayCompany[]> {
  const select = 'name, description, industry, headcount, location, country, website, linkedin'

  // Full-text search first
  let q = supabase
    .from('clay_companies')
    .select(select)
    .textSearch('search_vec', query.split(' ').filter(t => t.length > 1).join(' & '), { config: 'english' })
    .limit(limit)

  if (excludeNames.length > 0) {
    q = q.not('name', 'in', `(${excludeNames.map(n => `"${n}"`).join(',')})`)
  }

  const { data: ftData } = await q
  if (ftData && ftData.length >= 10) return ftData as ClayCompany[]

  // Fall back to ILIKE on industry + name
  const terms = query.split(' ').filter(t => t.length > 2)
  const ilikeFilter = terms.map(t => `industry.ilike.%${t}%,name.ilike.%${t}%`).join(',')

  let q2 = supabase
    .from('clay_companies')
    .select(select)
    .or(ilikeFilter)
    .limit(limit)

  if (excludeNames.length > 0) {
    q2 = q2.not('name', 'in', `(${excludeNames.map(n => `"${n}"`).join(',')})`)
  }

  const { data: ilikeData } = await q2
  return (ilikeData ?? []) as ClayCompany[]
}

// ─── Sector structure (no companies) ─────────────────────────────────────────

const STRUCTURE_SYSTEM = `You are an early-stage VC market analyst. Return ONLY a raw JSON object — no markdown, no code fences. Response must begin with { and end with }.

Return this exact structure:
{
  "sector": "string",
  "summary": "2-3 sentences on landscape and early-stage opportunity",
  "last_updated": "ISO date",
  "total_market_size": "e.g. '$4.2B TAM (2024)'",
  "segments": [
    { "id": "snake_case", "name": "string", "description": "1 sentence", "color": "unique hex color" }
  ],
  "white_spaces": ["1-sentence early-stage opportunity"],
  "key_trends": [{ "title": "string", "description": "1-2 sentences" }],
  "notable_exits": [{ "company": "string", "acquirer_or_ipo": "string", "year": 2024, "value_display": "string" }],
  "data_sources": ["string"]
}

Rules:
- 4-5 segments, NO companies array inside segments
- 3-4 white_spaces, 3-4 key_trends, 2-3 notable_exits
- Return ONLY the raw JSON object`

// ─── Organize real companies into segments ────────────────────────────────────

const ORGANIZE_SYSTEM = `You are an early-stage VC analyst. You will be given REAL companies from a verified database. Organize them into market segments and enrich each with VC intelligence.

Return ONLY a raw JSON array of segments — no markdown, no code fences. Begin with [ and end with ].

Each segment:
{
  "id": "snake_case",
  "name": "string",
  "companies": [
    {
      "id": "snake_case_of_name",
      "name": "MUST match exact company name provided",
      "tagline": "1 sentence from their description",
      "founded": 2020,
      "stage": "Seed",
      "total_funding_usd": 0,
      "funding_display": "~$2M",
      "last_round": "Seed, ~2023",
      "valuation_display": "~$10M",
      "headcount_range": "use provided headcount",
      "hq": "use provided location",
      "website": "use provided website",
      "linkedin": "use provided linkedin",
      "differentiator": "1-2 sentences from description on actual moat",
      "key_customers": [],
      "investors": [],
      "momentum_signal": "📈 Growing",
      "is_focal_company": false
    }
  ]
}

Rules:
- Use ONLY companies provided — do NOT invent any companies
- company name must exactly match the input name
- Use provided website, linkedin, headcount, location — do not change them
- For stage/funding/investors: use your knowledge of these real companies; prefix uncertain values with "~"
- stage: Pre-Seed | Seed | Series A | Series B | Series C | Series D+ | Public | Acquired | Bootstrapped
- momentum_signal: 🚀 Hypergrowth | 📈 Growing | ➡️ Stable | ⚠️ Challenged | 🔒 Stealth
- Group into 3-5 thematic segments based on the query
- Return ONLY the raw JSON array`

// Safely parse a JSON array, tolerating trailing truncation
function parseJsonArray(raw: string): unknown[] {
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start === -1) throw new Error('No JSON array found in response')
  if (end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)) } catch { /* fall through to repair */ }
  }
  // Try to recover by finding the last complete object
  const fragment = raw.slice(start)
  let depth = 0; let lastClose = -1
  for (let i = 0; i < fragment.length; i++) {
    if (fragment[i] === '{') depth++
    else if (fragment[i] === '}') { depth--; if (depth === 0) lastClose = i }
  }
  if (lastClose === -1) throw new Error('Could not recover JSON from response')
  try { return JSON.parse(fragment.slice(0, lastClose + 1) + ']') } catch {
    throw new Error('Could not parse JSON even after repair attempt')
  }
}

async function organizeRealCompanies(
  query: string,
  sector: string,
  companies: ClayCompany[],
): Promise<{ id: string; name: string; companies: Company[] }[]> {
  // Limit to 30 companies — keeps output well within token budget and fast
  const batch = companies.slice(0, 30)
  const companyList = batch.map(c => ({
    name: c.name,
    description: c.description?.slice(0, 100),
    industry: c.industry,
    headcount: c.headcount,
    location: c.location ? `${c.location}${c.country ? ', ' + c.country : ''}` : c.country,
    website: c.website,
    linkedin: c.linkedin,
  }))

  const prompt = `Query: "${query}" | Sector: ${sector}

Organize these ${batch.length} real companies into 3-5 market segments relevant to the query.

Companies:
${JSON.stringify(companyList, null, 1)}`

  const raw = await callHaiku(ORGANIZE_SYSTEM, prompt, 5000)
  return parseJsonArray(raw) as { id: string; name: string; companies: Company[] }[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateMarketMap(query: string): Promise<MarketMap> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  // Run structure + DB search in parallel
  const [structureRaw, realCompanies] = await Promise.all([
    callHaiku(STRUCTURE_SYSTEM, query, 1500),
    searchClayCompanies(query).catch(() => [] as ClayCompany[]),
  ])

  const s = structureRaw.indexOf('{')
  const e = structureRaw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error(`Could not parse structure. Response: ${structureRaw.slice(0, 200)}`)

  type StructureMap = Omit<MarketMap, 'segments'> & { segments: { id: string; name: string; description: string; color: string }[] }
  const structure = JSON.parse(structureRaw.slice(s, e + 1)) as StructureMap

  if (realCompanies.length === 0) {
    // No matches in database — return structure with empty segments
    return {
      ...structure,
      segments: structure.segments.map(seg => ({ ...seg, companies: [] })),
    }
  }

  // Organize real companies into segments
  const organizedSegments = await organizeRealCompanies(query, structure.sector, realCompanies)

  return {
    ...structure,
    segments: organizedSegments.map((seg, i) => ({
      ...seg,
      description: structure.segments[i]?.description ?? '',
      color: structure.segments[i]?.color ?? '#c9a84c',
      companies: seg.companies ?? [],
    })),
  }
}

// ─── All companies for segment detail page ───────────────────────────────────

async function enrichBatch(
  segmentName: string,
  sector: string,
  segmentDescription: string,
  batch: ClayCompany[],
): Promise<Company[]> {
  const companyList = batch.map(c => ({
    name: c.name,
    description: c.description?.slice(0, 100),
    industry: c.industry,
    headcount: c.headcount,
    location: c.location ? `${c.location}${c.country ? ', ' + c.country : ''}` : c.country,
    website: c.website,
    linkedin: c.linkedin,
  }))

  const prompt = `Segment: "${segmentName}" in the ${sector} market (${segmentDescription})

Enrich these ${batch.length} real companies and return as a flat JSON array of company objects.
Use ONLY these companies — do not invent any others.

Companies:
${JSON.stringify(companyList, null, 1)}`

  const raw = await callHaiku(ORGANIZE_SYSTEM, prompt, 5000)
  const parsed = parseJsonArray(raw)
  if (parsed[0] && typeof parsed[0] === 'object' && 'companies' in (parsed[0] as object)) {
    return (parsed as { companies: Company[] }[]).flatMap(seg => seg.companies ?? [])
  }
  return parsed as Company[]
}

export async function searchAndEnrichSegment(
  sector: string,
  segmentName: string,
  segmentDescription: string,
): Promise<Company[]> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  // Fetch up to 75 real companies from Clay DB
  const candidates = await searchClayCompanies(`${segmentName} ${sector}`, 75)
  if (candidates.length === 0) return []

  // Process in parallel batches of 25 — each batch fits well within token budget
  const BATCH = 25
  const batches: ClayCompany[][] = []
  for (let i = 0; i < candidates.length; i += BATCH) batches.push(candidates.slice(i, i + BATCH))

  const results = await Promise.all(
    batches.map(batch => enrichBatch(segmentName, sector, segmentDescription, batch).catch(() => [] as Company[]))
  )

  return results.flat()
}

// ─── AI Investment Scoring (Mucker Capital Framework) ────────────────────────

const SCORE_SYSTEM = `You are a General Partner at Mucker Capital, an LA-based VC leading pre-seed, seed, and Series A investments. Score each company 1-10 as a Mucker Capital investment opportunity.

Scale:
10 = Would lead immediately. Exceptional PMF signals, one-of-one market, credible $1B+ exit.
7-8 = Strong. Want to meet. Clear ICP, real differentiation, right stage.
5-6 = Watch. Some signals but uncertain traction or market size.
3-4 = Weak. Crowded market, vague ICP, wrong stage, or no moat.
1-2 = Clear pass. Series B+, commoditized problem, or ⚠️ Challenged with no defensibility.

Criteria:
- Problem: Urgent, frequent, expensive unsolved? Clear ICP with willingness to pay?
- Market: Bottoms-up path to $1B+ exit? Multiple strategic acquirers?
- Competition: Non-crowded? No dominant incumbent? "One-of-one" position?
- Traction: ≥2× YoY growth? Retention? NRR? Early PMF signals?
- Stage fit: Pre-Seed/Seed/Series A = preferred. Series B+ = penalize heavily.
- Efficiency: Disciplined burn? Strong unit economics signals?

Favor: B2B SaaS, fintech, marketplace, non-obvious sectors, 🚀/📈 momentum, small teams with early signal.
Penalize: Series B+, crowded SaaS, generic "AI for X", ⚠️ Challenged momentum.

You will receive a JSON array of companies. Return ONLY a JSON array of integer scores in the exact same order.
Example input: [{...}, {...}, {...}]
Example output: [7, 4, 9]
No explanation, no markdown, nothing else.`

export async function scoreCompanies(companies: Company[]): Promise<Record<string, number>> {
  if (!API_KEY || companies.length === 0) return {}
  const BATCH = 25
  const results: Record<string, number> = {}
  const chunks: Company[][] = []
  for (let i = 0; i < companies.length; i += BATCH) chunks.push(companies.slice(i, i + BATCH))

  await Promise.all(chunks.map(async chunk => {
    const list = chunk.map(c => ({
      name: c.name,
      tagline: c.tagline?.slice(0, 80),
      stage: c.stage,
      headcount: c.headcount_range,
      funding: c.funding_display,
      momentum: c.momentum_signal,
      differentiator: c.differentiator?.slice(0, 80),
      founded: c.founded,
    }))
    try {
      const raw = await callHaiku(SCORE_SYSTEM, JSON.stringify(list), 600)
      // Expect a JSON array: [7, 4, 9, ...]
      const start = raw.indexOf('['); const end = raw.lastIndexOf(']')
      if (start === -1 || end <= start) return
      const scores: unknown[] = JSON.parse(raw.slice(start, end + 1))
      scores.forEach((score, idx) => {
        const company = chunk[idx]
        if (company && typeof score === 'number' && score >= 1 && score <= 10) {
          results[company.id] = Math.round(score)
        }
      })
    } catch { /* silently ignore */ }
  }))

  return results
}

// ─── Load more from Clay database ────────────────────────────────────────────

export async function fetchMoreCompanies(
  sector: string,
  segmentName: string,
  segmentDescription: string,
  existingNames: string[],
): Promise<Company[]> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  // Search Clay DB for more companies matching the segment
  const searchQuery = `${segmentName} ${sector}`
  const candidates = await searchClayCompanies(searchQuery, 40, existingNames)

  if (candidates.length === 0) throw new Error('No more companies found in the database for this segment.')

  // Use Claude to enrich and format them — real companies only
  const companyList = candidates.map(c => ({
    name: c.name,
    description: c.description?.slice(0, 150),
    industry: c.industry,
    headcount: c.headcount,
    location: c.location ? `${c.location}${c.country ? ', ' + c.country : ''}` : c.country,
    website: c.website,
    linkedin: c.linkedin,
  }))

  const prompt = `Segment: "${segmentName}" in the ${sector} market (${segmentDescription})

Enrich these real companies with VC intelligence and return as a JSON array.
Use ONLY these companies — do not add any others.

Companies:
${JSON.stringify(companyList, null, 1)}`

  const raw = await callHaiku(ORGANIZE_SYSTEM, prompt, 8000)

  // ORGANIZE_SYSTEM returns segments array — flatten all companies out
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error('Could not parse company array')

  const parsed = JSON.parse(raw.slice(start, end + 1))

  // Handle both formats: array of segments or array of companies directly
  if (parsed[0]?.companies) {
    return parsed.flatMap((seg: { companies: Company[] }) => seg.companies ?? []) as Company[]
  }
  return parsed as Company[]
}
