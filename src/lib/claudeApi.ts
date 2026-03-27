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

async function searchClayCompanies(query: string, limit = 80): Promise<ClayCompany[]> {
  // Try full-text search first
  const { data: ftData } = await supabase
    .from('clay_companies')
    .select('name, description, industry, headcount, location, country, website, linkedin')
    .textSearch('search_vec', query.split(' ').join(' & '), { config: 'english' })
    .limit(limit)

  if (ftData && ftData.length >= 10) return ftData as ClayCompany[]

  // Fall back to ILIKE on industry + name
  const terms = query.split(' ').filter(t => t.length > 2)
  const ilikeFilter = terms.map(t => `industry.ilike.%${t}%,name.ilike.%${t}%`).join(',')

  const { data: ilikeData } = await supabase
    .from('clay_companies')
    .select('name, description, industry, headcount, location, country, website, linkedin')
    .or(ilikeFilter)
    .limit(limit)

  return (ilikeData ?? []) as ClayCompany[]
}

// ─── Phase 1: Sector structure (no companies) ─────────────────────────────────

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
- Use ONLY companies provided — do NOT invent companies
- company name must exactly match the input name
- Use provided website, linkedin, headcount, location — do not change them
- For stage/funding/investors: use your knowledge of these real companies; prefix uncertain values with "~"
- stage: Pre-Seed | Seed | Series A | Series B | Series C | Series D+ | Public | Acquired | Bootstrapped
- momentum_signal: 🚀 Hypergrowth | 📈 Growing | ➡️ Stable | ⚠️ Challenged | 🔒 Stealth
- Group into 3-5 thematic segments based on the query
- Prioritize early-stage companies when multiple options fit a segment
- Return ONLY the raw JSON array`

async function organizeRealCompanies(
  query: string,
  sector: string,
  companies: ClayCompany[],
): Promise<{ id: string; name: string; companies: Company[] }[]> {
  const companyList = companies.map(c => ({
    name: c.name,
    description: c.description?.slice(0, 150),
    industry: c.industry,
    headcount: c.headcount,
    location: c.location ? `${c.location}${c.country ? ', ' + c.country : ''}` : c.country,
    website: c.website,
    linkedin: c.linkedin,
  }))

  const prompt = `Query: "${query}" | Sector: ${sector}

Organize these ${companies.length} real companies into 3-5 market segments relevant to the query.

Companies:
${JSON.stringify(companyList, null, 1)}`

  const raw = await callHaiku(ORGANIZE_SYSTEM, prompt, 12000)
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error('Could not parse organized segments')
  return JSON.parse(raw.slice(start, end + 1))
}

// ─── Phase 2 fallback: AI-generated companies per segment ─────────────────────

const COMPANIES_SYSTEM = `You are an early-stage VC analyst. Return ONLY a raw JSON array — no markdown, no code fences. Response must begin with [ and end with ].

Each company object must have exactly these fields:
{ "id": "snake_case", "name": "string", "tagline": "string", "founded": 2020, "stage": "Seed", "total_funding_usd": 0, "funding_display": "$2M", "last_round": "Seed, Jan 2024", "valuation_display": "~$12M", "headcount_range": "1-10", "hq": "city, country", "website": "acme.com", "linkedin": "company/acme", "differentiator": "1-2 sentences on actual moat", "key_customers": ["string"], "investors": ["string"], "momentum_signal": "📈 Growing", "is_focal_company": false }

stage must be one of: Pre-Seed | Seed | Series A | Series B | Series C | Series D+ | Public | Acquired | Bootstrapped
momentum_signal must be one of: 🚀 Hypergrowth | 📈 Growing | ➡️ Stable | ⚠️ Challenged | 🔒 Stealth
At least 60% of companies must be Pre-Seed, Seed, or Series A.
Only real companies. Return ONLY the raw JSON array.`

async function generateSegmentCompanies(
  sector: string,
  segmentName: string,
  segmentDescription: string,
  query: string,
  isFocalCompany: boolean,
): Promise<Company[]> {
  const prompt = `List 6 real companies in the "${segmentName}" segment of the ${sector} market.
Segment description: ${segmentDescription}
Original query: ${query}
${isFocalCompany ? `If "${query}" fits this segment, include it with is_focal_company: true.` : ''}

Prioritize Pre-Seed, Seed, Series A companies (at least 4 of 6). Include 1-2 Series B+ only as market context.
Use "~" prefix on uncertain numbers. Include non-US companies if significant.`

  const raw = await callHaiku(COMPANIES_SYSTEM, prompt, 4000)
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error(`Bad company array for segment "${segmentName}"`)
  return JSON.parse(raw.slice(start, end + 1)) as Company[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateMarketMap(query: string): Promise<MarketMap> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  // Phase 1: sector structure (always fast)
  const structureRaw = await callHaiku(STRUCTURE_SYSTEM, query, 1500)
  const s = structureRaw.indexOf('{')
  const e = structureRaw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error(`Could not parse structure. Response: ${structureRaw.slice(0, 200)}`)

  type StructureMap = Omit<MarketMap, 'segments'> & { segments: { id: string; name: string; description: string; color: string }[] }
  const structure = JSON.parse(structureRaw.slice(s, e + 1)) as StructureMap

  // Phase 2a: try to find real companies from Clay database
  const realCompanies = await searchClayCompanies(query).catch(() => [] as ClayCompany[])

  if (realCompanies.length >= 10) {
    // Organize real companies into segments
    const organizedSegments = await organizeRealCompanies(query, structure.sector, realCompanies)
      .catch(() => null)

    if (organizedSegments && organizedSegments.length > 0) {
      // Merge segment colors from structure into organized segments
      const colorMap: Record<string, string> = {}
      structure.segments.forEach((seg, i) => {
        colorMap[i] = seg.color
      })

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
  }

  // Phase 2b: fallback — AI-generated companies (no Clay data for this query)
  const isFocal = !structure.sector.toLowerCase().includes(query.toLowerCase().split(' ')[0])
  const companiesPerSegment = await Promise.all(
    structure.segments.map(seg =>
      generateSegmentCompanies(structure.sector, seg.name, seg.description, query, isFocal)
        .catch(() => [] as Company[])
    )
  )

  return {
    ...structure,
    segments: structure.segments.map((seg, i) => ({
      ...seg,
      companies: companiesPerSegment[i] ?? [],
    })),
  }
}

// ─── Load more ────────────────────────────────────────────────────────────────

const MORE_SYSTEM = `You are a market intelligence analyst. Return ONLY a raw JSON array with no markdown, no code fences. Your entire response must begin with [ and end with ].`

export async function fetchMoreCompanies(
  sector: string,
  segmentName: string,
  segmentDescription: string,
  existingNames: string[],
  batchSize = 20
): Promise<Company[]> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  const prompt = `List ${batchSize} real companies in the "${segmentName}" segment of the ${sector} market (${segmentDescription}). Focus primarily on early-stage companies (Pre-Seed, Seed, Series A) — at least 70% should be at these stages.

Exclude these already-listed companies: ${existingNames.join(', ')}

Return a JSON array of ${batchSize} objects, each with exactly these fields:
["id","name","tagline","founded","stage","total_funding_usd","funding_display","last_round","valuation_display","headcount_range","hq","website","linkedin","differentiator","key_customers","investors","momentum_signal","is_focal_company"]

- id: snake_case string
- founded: number
- stage: one of Pre-Seed | Seed | Series A | Series B | Series C | Series D+ | Public | Acquired | Bootstrapped
- total_funding_usd: number
- headcount_range: e.g. "50-200"
- website: domain only e.g. "acme.com"
- linkedin: slug only e.g. "company/acme"
- momentum_signal: one of 🚀 Hypergrowth | 📈 Growing | ➡️ Stable | ⚠️ Challenged | 🔒 Stealth
- is_focal_company: false
- key_customers and investors: arrays of strings

Only real companies. No duplicates. Begin with [ and end with ].`

  const raw = await callHaiku(MORE_SYSTEM, prompt, 8000)
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error(`Could not parse company array. Response: ${raw.slice(0, 200)}`)
  return JSON.parse(raw.slice(start, end + 1)) as Company[]
}
