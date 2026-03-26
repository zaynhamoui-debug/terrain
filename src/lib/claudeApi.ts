import { MarketMap, Company } from '../types/marketMap'

const API_KEY    = import.meta.env.VITE_ANTHROPIC_API_KEY as string
const MODEL_FAST = 'claude-haiku-4-5-20251001'

interface TextBlock   { type: 'text'; text: string }
interface ApiResponse { content: { type: string; text?: string }[] }

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

// ─── Phase 2: Companies per segment ───────────────────────────────────────────

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

  // Phase 1: get structure (fast, ~1500 tokens output)
  const structureRaw = await callHaiku(STRUCTURE_SYSTEM, query, 1500)
  const s = structureRaw.indexOf('{')
  const e = structureRaw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error(`Could not parse structure. Response: ${structureRaw.slice(0, 200)}`)

  type StructureMap = Omit<MarketMap, 'segments'> & { segments: { id: string; name: string; description: string; color: string }[] }
  const structure = JSON.parse(structureRaw.slice(s, e + 1)) as StructureMap

  // Phase 2: generate all segments in parallel
  const isFocal = !structure.sector.toLowerCase().includes(query.toLowerCase().split(' ')[0])
  const companiesPerSegment = await Promise.all(
    structure.segments.map(seg =>
      generateSegmentCompanies(structure.sector, seg.name, seg.description, query, isFocal)
        .catch(() => [] as Company[])  // don't fail the whole map if one segment errors
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
