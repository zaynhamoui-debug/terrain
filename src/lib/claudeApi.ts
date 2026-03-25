import { MarketMap, Company } from '../types/marketMap'

const API_KEY        = import.meta.env.VITE_ANTHROPIC_API_KEY as string
const MODEL_FULL     = 'claude-sonnet-4-5'
const MODEL_FAST     = 'claude-haiku-4-5-20251001'
const MAX_TOKENS     = 16000
const MAX_TOKENS_FAST = 4000

const SYSTEM_PROMPT = `You are an elite market intelligence analyst. Given a sector or company name, research and return a comprehensive market map as a single valid JSON object with NO markdown, no preamble, no text outside the JSON.

Schema:
{
  "sector": "string",
  "summary": "2-3 sentence landscape overview",
  "last_updated": "ISO date",
  "total_market_size": "string e.g. '$4.2B TAM (2024)'",
  "segments": [
    {
      "id": "snake_case",
      "name": "string",
      "description": "1 sentence",
      "color": "hex color, unique per segment",
      "companies": [
        {
          "id": "snake_case",
          "name": "string",
          "tagline": "string",
          "founded": "number",
          "stage": "Pre-Seed | Seed | Series A | Series B | Series C | Series D+ | Public | Acquired | Bootstrapped",
          "total_funding_usd": "number",
          "funding_display": "string e.g. '$142M'",
          "last_round": "string e.g. 'Series C, Jan 2024'",
          "valuation_display": "string",
          "headcount_range": "string e.g. '50-200'",
          "hq": "city, country",
          "website": "domain only, e.g. acme.com",
          "linkedin": "LinkedIn company page slug only, e.g. company/acme",
          "differentiator": "1-2 sentences on moat, not marketing copy",
          "key_customers": ["string"],
          "investors": ["string"],
          "momentum_signal": "🚀 Hypergrowth | 📈 Growing | ➡️ Stable | ⚠️ Challenged | 🔒 Stealth",
          "is_focal_company": "boolean"
        }
      ]
    }
  ],
  "white_spaces": ["string — each a 1-sentence gap or unmet opportunity"],
  "key_trends": [{ "title": "string", "description": "1-2 sentences" }],
  "notable_exits": [{ "company": "string", "acquirer_or_ipo": "string", "year": "number", "value_display": "string" }],
  "data_sources": ["string"]
}

Rules:
- 3-7 segments, 4-10 companies each
- Differentiator must describe the actual moat, not generic claims
- Use "~" prefix on uncertain numbers
- Include bootstrapped players if they exist
- Include non-US companies if significant
- Mark is_focal_company: true if the input was a company name
- Always include 3-5 white_spaces — this is the highest-value output
- momentum_signal must be genuinely assessed, not all "Growing"
- Return ONLY the raw JSON object. Your entire response must begin with { and end with }. No markdown, no code fences, no explanation before or after.`

interface TextBlock { type: 'text'; text: string }
interface ApiResponse { content: { type: string; text?: string }[] }

function extractJson(raw: string): MarketMap {
  // Slice from first '{' to last '}' — handles any preamble or trailing text
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')

  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)) } catch { /* fall through */ }
  }

  throw new Error(`Could not parse JSON. Response started with: ${raw.slice(0, 200)}`)
}

async function callClaude(userContent: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                                 API_KEY,
      'anthropic-version':                         '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type':                              'application/json',
    },
    body: JSON.stringify({
      model:      MODEL_FULL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userContent }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`
    )
  }

  const data: ApiResponse = await res.json()
  const textBlock = data.content.find((b): b is TextBlock => b.type === 'text')
  if (!textBlock?.text) throw new Error('No text in API response')
  return textBlock.text
}

const MORE_SYSTEM = `You are a market intelligence analyst. Return ONLY a raw JSON array with no markdown, no code fences, no explanation. Your entire response must begin with [ and end with ].`

export async function fetchMoreCompanies(
  sector: string,
  segmentName: string,
  segmentDescription: string,
  existingNames: string[],
  batchSize = 20
): Promise<Company[]> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  const prompt = `List ${batchSize} real companies in the "${segmentName}" segment of the ${sector} market (${segmentDescription}).

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
      max_tokens: MAX_TOKENS_FAST,
      system:     MORE_SYSTEM,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`
    )
  }

  const data: ApiResponse = await res.json()
  const textBlock = data.content.find((b): b is TextBlock => b.type === 'text')
  if (!textBlock?.text) throw new Error('No text in API response')

  const raw = textBlock.text
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error(`Could not parse company array. Response: ${raw.slice(0, 200)}`)

  return JSON.parse(raw.slice(start, end + 1)) as Company[]
}

export async function generateMarketMap(query: string): Promise<MarketMap> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  const text = await callClaude(query)

  try {
    return extractJson(text)
  } catch {
    // Retry once, asking Claude to fix the JSON
    const retryText = await callClaude(
      `You previously returned this response for the query "${query}":\n\n${text}\n\n` +
      `It could not be parsed as JSON. Return ONLY the corrected JSON object with no markdown, no explanation, no code fences.`
    )
    return extractJson(retryText)
  }
}
