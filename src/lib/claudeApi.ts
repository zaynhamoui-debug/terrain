import { MarketMap, Company, Segment } from '../types/marketMap'
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

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ─── Web-search-verified company discovery ────────────────────────────────────

const WEB_SEARCH_COMPANY_SYSTEM = `You are a market research analyst who finds vendors from the END CUSTOMER'S perspective. Given a query, first identify who the actual practitioner/buyer is, then find the real software vendors those practitioners use today.

Think like the customer: search for "[customer type] software reviews", "[customer type] best tools", "what software do [customer type] use", review sites like G2/Capterra for that category, and industry forums where practitioners discuss their tools.

For every company you return you MUST:
1. Search the web to confirm it is a real vendor actively used by the target customer
2. Confirm the website URL belongs to this company and the company serves the right customer
3. Only include vendors with clear evidence of real customer adoption

Return ONLY a raw JSON array — no markdown, no code fences. Begin with [ and end with ].

Each object:
{
  "name": "Exact company name as it appears on their website",
  "website": "https://verified-url.com",
  "linkedin": "https://linkedin.com/company/slug or null",
  "description": "1-2 sentences on what the end customer uses this for",
  "industry": "Primary industry (e.g. Field Service Software, HealthTech, FinTech)",
  "headcount": null,
  "location": "City, State or null",
  "country": "Country or null"
}

Rules:
- Prioritise vendors with real customer reviews, case studies, or market presence
- Only include companies you have verified via web search — no invented URLs
- Return 10-20 verified companies`

async function webSearchCompanies(query: string): Promise<ClayCompany[]> {
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
      system:     WEB_SEARCH_COMPANY_SYSTEM,
      tools: [{
        type:     'web_search_20250305',
        name:     'web_search',
        max_uses: 10,
      }],
      messages: [{ role: 'user', content: `Query: "${query}"\n\nFirst identify who the end customer/practitioner is for this query. Then search for the actual vendors those customers use today — check review sites, industry forums, and trade publications to find tools with real adoption. Verify each website and return the JSON array.` }],
    }),
  })

  if (!res.ok) return []

  const data = await res.json()
  const textBlock = [...(data.content ?? [])].reverse().find(
    (b: { type: string; text?: string }) => b.type === 'text' && b.text
  ) as { type: string; text: string } | undefined

  if (!textBlock?.text) return []

  try {
    const raw   = textBlock.text
    const start = raw.indexOf('[')
    const end   = raw.lastIndexOf(']')
    if (start === -1 || end <= start) return []
    return JSON.parse(raw.slice(start, end + 1)) as ClayCompany[]
  } catch {
    return []
  }
}

/** Check if a URL is actually reachable from the browser.
 *  Uses no-cors so CORS blocks still count as "reachable" (server responded).
 *  Only returns false on network errors (bad domain, DNS failure, connection refused). */
async function isUrlReachable(url: string, timeoutMs = 6000): Promise<boolean> {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal })
    clearTimeout(id)
    return true
  } catch {
    return false
  }
}

/** Filter a map of companies to only those with reachable URLs, checked in parallel. */
async function filterReachable(companies: Map<string, ClayCompany>): Promise<Map<string, ClayCompany>> {
  const entries = [...companies.entries()]
  const results = await Promise.all(
    entries.map(async ([key, c]) => ({
      key,
      c,
      ok: c.website ? await isUrlReachable(c.website) : false,
    }))
  )
  const out = new Map<string, ClayCompany>()
  for (const { key, c, ok } of results) if (ok) out.set(key, c)
  return out
}

/** Verify competitor websites via web search.
 *  Claude MUST search for and navigate to each company — never use memory for URLs.
 *  Returns name → verified ClayCompany. */
async function webVerifyCompetitors(
  competitors: string[],
  sector: string,
): Promise<Map<string, ClayCompany>> {
  if (competitors.length === 0) return new Map()

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
      max_tokens: 5000,
      system:     `You verify company websites by actually searching the web. You MUST use the web_search tool for every company — do NOT use URLs from memory or training data.

For each company:
1. Run a web search: "[company name] official website ${sector}"
2. Look at the actual search results to find the real URL
3. Only use the URL if the search result clearly shows it belongs to this company
4. If the search does not return a clear match, omit the company entirely

CRITICAL RULES:
- NEVER output a URL you have not found via web_search in this session
- If you are not 100% certain a URL is correct from the search results, omit the company
- Do not guess, infer, or construct URLs
- LinkedIn: search "[company name] LinkedIn" and use the /company/ URL from results

Return ONLY a raw JSON array. Begin with [ end with ].
Each object: { "name": "exact input name", "website": "https://url-from-search-results.com", "linkedin": "https://linkedin.com/company/slug or null", "description": "1 sentence from search result", "industry": "${sector}", "headcount": null, "location": null, "country": null }`,
      tools: [{
        type:     'web_search_20250305',
        name:     'web_search',
        max_uses: competitors.length * 2 + 5,
      }],
      messages: [{
        role:    'user',
        content: `Use web search to find and verify the real website for each of these ${sector} companies. You MUST search for each one individually — do not use any URL from memory.\n\nCompanies to verify:\n${competitors.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nSearch for each company, check the result URLs, and only include companies whose websites you found in search results. Return the JSON array.`,
      }],
    }),
  })

  if (!res.ok) return new Map()

  const data      = await res.json()
  const textBlock = [...(data.content ?? [])].reverse().find(
    (b: { type: string; text?: string }) => b.type === 'text' && b.text
  ) as { type: string; text: string } | undefined

  if (!textBlock?.text) return new Map()

  try {
    const raw   = textBlock.text
    const start = raw.indexOf('[')
    const end   = raw.lastIndexOf(']')
    if (start === -1 || end <= start) return new Map()
    const verified = JSON.parse(raw.slice(start, end + 1)) as ClayCompany[]
    const map = new Map<string, ClayCompany>()
    for (const c of verified) {
      if (c.name && c.website) map.set(c.name.toLowerCase(), c)
    }
    // Final pass: drop any URL that is actually unreachable
    return await filterReachable(map)
  } catch {
    return new Map()
  }
}

/** Merge Clay DB results with web-search results, deduplicating by lowercase name.
 *  Clay DB entry takes priority (richer data); web-search fills gaps.
 *  Filters out companies with unreachable URLs before returning. */
async function mergeCompanySources(db: ClayCompany[], web: ClayCompany[]): Promise<ClayCompany[]> {
  const merged = new Map<string, ClayCompany>()
  for (const c of db)  if (c.website) merged.set(c.name.toLowerCase(), c)
  for (const c of web) {
    const key = c.name.toLowerCase()
    if (!merged.has(key) && c.website) merged.set(key, c)
  }
  const reachable = await filterReachable(merged)
  return [...reachable.values()]
}

async function callHaiku(system: string, user: string, maxTokens: number, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
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

    if (res.status === 429 && attempt < retries) {
      await sleep(4000 * (attempt + 1))
      continue
    }

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
  throw new Error('Max retries exceeded')
}

// ─── Search real companies from Clay database ─────────────────────────────────

// Generic words that match too broadly and should not be used alone in ILIKE search
const NOISE_WORDS = new Set([
  'technology', 'technologies', 'solutions', 'services', 'systems', 'group',
  'global', 'digital', 'platform', 'platforms', 'software', 'cloud', 'data',
  'intelligence', 'advanced', 'management', 'international', 'enterprises',
  'inc', 'corp', 'llc', 'ltd', 'company', 'companies', 'and', 'for', 'the',
])

/** Look up companies by exact/close name match — returns a map of lowercase name → ClayCompany */
async function lookupCompaniesByName(names: string[]): Promise<Map<string, ClayCompany>> {
  if (names.length === 0) return new Map()
  const select = 'name, description, industry, headcount, location, country, website, linkedin'
  // Build OR filter: name.ilike.%Stripe%,name.ilike.%Adyen%,...
  const nameFilter = names.map(n => `name.ilike.%${n}%`).join(',')
  const { data } = await supabase
    .from('clay_companies')
    .select(select)
    .or(nameFilter)
    .not('website', 'is', null)  // only verified companies
    .limit(names.length * 3)
  const result = new Map<string, ClayCompany>()
  for (const company of (data ?? []) as ClayCompany[]) {
    result.set(company.name.toLowerCase(), company)
  }
  return result
}

async function searchClayCompanies(query: string, limit = 40, excludeNames: string[] = []): Promise<ClayCompany[]> {
  const select = 'name, description, industry, headcount, location, country, website, linkedin'

  const allTerms      = query.split(/\s+/).filter(t => t.length > 1)
  const orFtsQuery    = allTerms.join(' | ')
  const specificTerms = allTerms.filter(t => !NOISE_WORDS.has(t.toLowerCase()) && t.length > 2)
  const excl          = excludeNames.length > 0
    ? `(${excludeNames.map(n => `"${n}"`).join(',')})`
    : null

  // 1. Full-text search with OR (broad recall, ranked by relevance)
  let q1 = supabase.from('clay_companies').select(select)
    .textSearch('search_vec', orFtsQuery, { config: 'english' })
    .limit(limit)
  if (excl) q1 = q1.not('name', 'in', excl)
  const { data: ftData } = await q1
  if (ftData && ftData.length >= 10) return ftData as ClayCompany[]

  // 2. ILIKE on industry + description using only specific (non-noise) terms
  const ilikeTerms = specificTerms.length > 0 ? specificTerms : allTerms.filter(t => t.length > 2)
  if (ilikeTerms.length === 0) return []

  const ilikeFilter = ilikeTerms
    .map(t => `industry.ilike.%${t}%,description.ilike.%${t}%`)
    .join(',')

  let q2 = supabase.from('clay_companies').select(select)
    .or(ilikeFilter)
    .limit(limit)
  if (excl) q2 = q2.not('name', 'in', excl)
  const { data: ilikeData } = await q2
  return (ilikeData ?? []) as ClayCompany[]
}

// ─── Sector structure (no companies) ─────────────────────────────────────────

const STRUCTURE_SYSTEM = `You are an early-stage VC market analyst who thinks from the END CUSTOMER'S perspective. When given a query, first identify WHO the actual practitioner/buyer is and WHAT they do daily — then map the vendor landscape around their real workflow.

For example: "plumbing software" → the customer is a plumbing contractor. Their workflow is: schedule jobs, dispatch techs, quote work, invoice customers, manage parts. Segments should reflect those jobs-to-be-done, not abstract vendor categories.

Return ONLY a raw JSON object — no markdown, no code fences. Response must begin with { and end with }.

{
  "sector": "string — name from the customer's perspective (e.g. 'Plumbing Contractor Software')",
  "end_customer": "string — who actually buys/uses this (e.g. 'Plumbing contractors & field techs')",
  "summary": "2-3 sentences: who the end customer is, what pain they have today, and what the early-stage opportunity looks like",
  "last_updated": "ISO date",
  "total_market_size": "e.g. '$4.2B TAM (2024)'",
  "segments": [
    { "id": "snake_case", "name": "string — a job the customer needs done (e.g. 'Job Scheduling & Dispatch')", "description": "1 sentence on what the customer does here and why current tools fall short", "color": "unique hex color" }
  ],
  "white_spaces": ["1-sentence gap in what the customer needs but vendors don't serve well"],
  "key_trends": [{ "title": "string", "description": "1-2 sentences on how customer behaviour is shifting" }],
  "notable_exits": [{ "company": "string", "acquirer_or_ipo": "string", "year": 2024, "value_display": "string" }],
  "data_sources": ["string"]
}

Rules:
- Segments must represent the CUSTOMER'S workflow steps or jobs-to-be-done — NOT abstract vendor categories like "Enterprise" or "SMB"
- 4-5 segments, NO companies array inside segments
- 3-4 white_spaces from the customer's unmet needs
- 3-4 key_trends, 2-3 notable_exits
- Return ONLY the raw JSON object`

// ─── Organize real companies into segments ────────────────────────────────────

const ORGANIZE_SYSTEM = `You are an early-stage VC analyst. You will be given REAL companies from a verified database. Organize them by the customer jobs they serve and enrich each with VC intelligence.

Return ONLY a raw JSON array of segments — no markdown, no code fences. Begin with [ and end with ].

Each segment:
{
  "id": "snake_case",
  "name": "string — the customer job or workflow step this segment addresses",
  "companies": [
    {
      "id": "snake_case_of_name",
      "name": "MUST match exact company name provided",
      "tagline": "1 sentence on what the END CUSTOMER uses this for — written from the customer's point of view",
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
      "differentiator": "1-2 sentences: what makes customers choose this over alternatives — cite real customer adoption signals if known",
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
- Group into 3-5 segments based on the customer workflow jobs, not vendor categories
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
  endCustomer?: string,
): Promise<{ id: string; name: string; companies: Company[] }[]> {
  // Limit to 30 companies — keeps output well within token budget and fast
  const batch = companies.slice(0, 30)
  // Build a lookup map so we can restore real DB values after Claude enriches
  const dbByName = new Map(batch.map(c => [c.name.toLowerCase(), c]))

  const companyList = batch.map(c => ({
    name: c.name,
    description: c.description?.slice(0, 100),
    industry: c.industry,
    headcount: c.headcount,
    location: c.location ? `${c.location}${c.country ? ', ' + c.country : ''}` : c.country,
    website: c.website,
    linkedin: c.linkedin,
  }))

  const customerLine = endCustomer ? `End customer: ${endCustomer}` : ''
  const prompt = `Query: "${query}" | Sector: ${sector}${customerLine ? '\n' + customerLine : ''}

Organize these ${batch.length} real companies into 3-5 segments based on the customer workflow jobs they serve${endCustomer ? ` for ${endCustomer}` : ''}.

Companies:
${JSON.stringify(companyList, null, 1)}`

  const raw = await callHaiku(ORGANIZE_SYSTEM, prompt, 3500)
  const segments = parseJsonArray(raw) as { id: string; name: string; companies: Company[] }[]

  // Re-enforce real DB website/linkedin — never allow Claude to override or invent
  // Also drop any company that isn't in our verified DB (no hallucinated entries)
  return segments.map(seg => ({
    ...seg,
    companies: (seg.companies ?? [])
      .map(c => {
        const real = dbByName.get(c.name.toLowerCase())
        if (!real?.website) return null   // exclude unverified companies
        return {
          ...c,
          website:         real.website,
          linkedin:        real.linkedin  ?? c.linkedin,
          headcount_range: real.headcount ?? c.headcount_range,
          hq:              real.location  ?? c.hq,
        }
      })
      .filter((c): c is Company => c !== null),
  }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateMarketMap(query: string): Promise<MarketMap> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  // Run structure, Clay DB search, and web search all in parallel
  const [structureRaw, dbCompanies, webCompanies] = await Promise.all([
    callHaiku(STRUCTURE_SYSTEM, query, 1500),
    searchClayCompanies(query).catch(() => [] as ClayCompany[]),
    webSearchCompanies(query).catch(() => [] as ClayCompany[]),
  ])

  const s = structureRaw.indexOf('{')
  const e = structureRaw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error(`Could not parse structure. Response: ${structureRaw.slice(0, 200)}`)

  type StructureMap = Omit<MarketMap, 'segments'> & { end_customer?: string; segments: { id: string; name: string; description: string; color: string }[] }
  const structure = JSON.parse(structureRaw.slice(s, e + 1)) as StructureMap

  // Merge DB + web-search results; filter out any unreachable URLs
  const realCompanies = await mergeCompanySources(dbCompanies, webCompanies)

  if (realCompanies.length === 0) {
    return {
      ...structure,
      segments: structure.segments.map(seg => ({ ...seg, companies: [] })),
    }
  }

  // Organize real companies into segments, passing end_customer context
  const organizedSegments = await organizeRealCompanies(query, structure.sector, realCompanies, structure.end_customer)

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
  // Build a lookup map so we can restore real DB values after Claude enriches
  const dbByName = new Map(batch.map(c => [c.name.toLowerCase(), c]))

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

Enrich the relevant companies below and return as a flat JSON array. Include companies that fit this segment or an adjacent area of the ${sector} market. Skip only companies that are clearly from a completely unrelated industry. Do not invent companies not in the list.

Companies:
${JSON.stringify(companyList, null, 1)}`

  const raw = await callHaiku(ORGANIZE_SYSTEM, prompt, 3000)
  const parsed = parseJsonArray(raw)
  const companies: Company[] = parsed[0] && typeof parsed[0] === 'object' && 'companies' in (parsed[0] as object)
    ? (parsed as { companies: Company[] }[]).flatMap(seg => seg.companies ?? [])
    : parsed as Company[]

  // Re-enforce real DB website/linkedin — drop any company not in our verified DB
  return companies
    .map(c => {
      const real = dbByName.get(c.name.toLowerCase())
      if (!real?.website) return null   // exclude unverified companies
      return {
        ...c,
        website:         real.website,
        linkedin:        real.linkedin  ?? c.linkedin,
        headcount_range: real.headcount ?? c.headcount_range,
        hq:              real.location  ?? c.hq,
      }
    })
    .filter((c): c is Company => c !== null)
}

export async function searchAndEnrichSegment(
  sector: string,
  segmentName: string,
  segmentDescription: string,
): Promise<Company[]> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  // Fetch up to 150 real companies from Clay DB
  const candidates = await searchClayCompanies(`${segmentName} ${sector}`, 150)
  if (candidates.length === 0) return []

  // Process in sequential batches of 25
  const BATCH = 25
  const batches: ClayCompany[][] = []
  for (let i = 0; i < candidates.length; i += BATCH) batches.push(candidates.slice(i, i + BATCH))

  const allResults: Company[] = []
  for (const [i, batch] of batches.entries()) {
    if (i > 0) await sleep(3000)
    const result = await enrichBatch(segmentName, sector, segmentDescription, batch).catch(() => [] as Company[])
    allResults.push(...result)
  }

  return allResults
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
  const BATCH = 30
  const results: Record<string, number> = {}
  const chunks: Company[][] = []
  for (let i = 0; i < companies.length; i += BATCH) chunks.push(companies.slice(i, i + BATCH))

  for (const [i, chunk] of chunks.entries()) {
    if (i > 0) await sleep(2000)
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
      if (start === -1 || end <= start) continue
      const scores: unknown[] = JSON.parse(raw.slice(start, end + 1))
      scores.forEach((score, idx) => {
        const company = chunk[idx]
        if (company && typeof score === 'number' && score >= 1 && score <= 10) {
          results[company.id] = Math.round(score)
        }
      })
    } catch { /* silently ignore */ }
  }

  return results
}

// ─── Company Landscape Analysis ──────────────────────────────────────────────

// Step 1: structure only — small output, no companies
const LANDSCAPE_STRUCTURE_SYSTEM = `You are a competitive intelligence analyst. Given a company name, identify its market and key competitors.

Return ONLY a raw JSON object — no markdown, no code fences. Begin with { and end with }.

{
  "sector": "Full market sector name (e.g. 'B2B Payments Infrastructure')",
  "focal_company": "exact company name as given",
  "summary": "2-3 sentences on competitive dynamics and where the focal company sits",
  "last_updated": "ISO date",
  "total_market_size": "e.g. '$4.2B TAM (2024)'",
  "segments": [
    { "id": "snake_case", "name": "string", "description": "1 sentence", "color": "unique hex" }
  ],
  "competitors": ["15-18 real company names in this market, including the focal company"],
  "white_spaces": ["1-sentence opportunity"],
  "key_trends": [{ "title": "string", "description": "1-2 sentences" }],
  "notable_exits": [{ "company": "string", "acquirer_or_ipo": "string", "year": 2024, "value_display": "string" }],
  "data_sources": ["string"]
}

Rules:
- 3-5 segments representing distinct product/service areas
- competitors: 15-18 real company names only (no objects), including the focal company
- 3-4 white_spaces, 3-4 key_trends, 2-3 notable_exits
- Return ONLY the raw JSON object`

// Step 2: flat company array — reuses ORGANIZE_SYSTEM but adds market_tier + segment_id
const LANDSCAPE_COMPANY_SYSTEM = `You are a competitive intelligence analyst categorizing companies by market position.

Market tiers:
- "Field Leader": Dominant established players (Public, Series D+, or well-known market leaders).
- "Challenger": Well-funded, fast-growing, actively competing for share (Series B-D).
- "Up and Comer": Rising startups with strong early traction (Seed-Series B).
- "Startup": Early-stage, innovative, unproven (Pre-Seed to Seed).
- "Niche Player": Focused on a specific sub-segment, not competing broadly.

Return ONLY a raw JSON array — no markdown, no code fences. Begin with [ and end with ].

Each element (keep fields concise):
{
  "id": "snake_case_of_name",
  "name": "MUST match exact input name",
  "tagline": "1 short sentence",
  "founded": 2020,
  "stage": "Series B",
  "total_funding_usd": 50000000,
  "funding_display": "~$50M",
  "last_round": "Series B, 2023",
  "valuation_display": "~$250M",
  "headcount_range": "use provided or estimate",
  "hq": "use provided location",
  "website": "use provided website",
  "linkedin": "use provided linkedin",
  "differentiator": "1 sentence on key advantage",
  "key_customers": [],
  "investors": [],
  "momentum_signal": "📈 Growing",
  "market_tier": "Challenger",
  "segment_id": "snake_case_segment_id",
  "is_focal_company": false
}

Rules:
- Mark the focal company with "is_focal_company": true
- Use provided website/linkedin/headcount/location — do not change them
- stage: Pre-Seed | Seed | Series A | Series B | Series C | Series D+ | Public | Acquired | Bootstrapped
- momentum_signal: 🚀 Hypergrowth | 📈 Growing | ➡️ Stable | ⚠️ Challenged | 🔒 Stealth
- market_tier: Field Leader | Challenger | Up and Comer | Startup | Niche Player
- Return ONLY the raw JSON array`

export async function analyzeCompanyLandscape(companyName: string, urlHint?: string): Promise<MarketMap> {
  if (!API_KEY) throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env')

  const context = urlHint
    ? `Analyze the competitive landscape for: ${companyName}\nURL hint: ${urlHint}`
    : `Analyze the competitive landscape for: ${companyName}`

  // Step 1: structure + competitor list (small, fast)
  const structureRaw = await callHaiku(
    LANDSCAPE_STRUCTURE_SYSTEM,
    context,
    1800,
  )

  const s = structureRaw.indexOf('{')
  const e = structureRaw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error(`Could not parse landscape structure. Response: ${structureRaw.slice(0, 200)}`)

  type LandscapeStructure = {
    sector: string
    focal_company: string
    summary: string
    last_updated: string
    total_market_size: string
    segments: { id: string; name: string; description: string; color: string }[]
    competitors: string[]
    white_spaces: string[]
    key_trends: { title: string; description: string }[]
    notable_exits: { company: string; acquirer_or_ipo: string; year: number; value_display: string }[]
    data_sources: string[]
  }

  const structure = JSON.parse(structureRaw.slice(s, e + 1)) as LandscapeStructure
  const competitors = structure.competitors ?? []

  // Look up competitors: Clay DB first (fast), then web-verify anything not found
  const [dbByNameRaw, webByName] = await Promise.all([
    lookupCompaniesByName(competitors).catch(() => new Map<string, ClayCompany>()),
    webVerifyCompetitors(competitors, structure.sector).catch(() => new Map<string, ClayCompany>()),
  ])

  // Filter Clay DB entries for reachable URLs too (stale entries exist)
  const dbByName = await filterReachable(dbByNameRaw)

  // Merge: Clay DB takes priority, web fills gaps
  const realByName = new Map<string, ClayCompany>([...webByName, ...dbByName])

  // If the user provided a URL for the focal company, that URL is authoritative.
  // Override whatever the DB / web search found for the focal company's website,
  // and separately web-verify its LinkedIn so we don't inherit a stale/wrong one.
  if (urlHint) {
    const focalKey = companyName.toLowerCase()
    const existing = realByName.get(focalKey) ?? { name: companyName, description: null, industry: null, headcount: null, location: null, country: null, website: null, linkedin: null }
    // Normalise the user-provided URL (strip trailing slash, ensure https)
    const normalisedUrl = urlHint.startsWith('http') ? urlHint.replace(/\/$/, '') : `https://${urlHint}`
    // Web-search for the verified LinkedIn only (don't trust the DB value)
    const linkedInMap = await webVerifyCompetitors([companyName], structure.sector).catch(() => new Map<string, ClayCompany>())
    const verifiedLinkedIn = linkedInMap.get(focalKey)?.linkedin ?? null
    realByName.set(focalKey, { ...existing, website: normalisedUrl, linkedin: verifiedLinkedIn })
  }

  // Step 2: categorize companies into tiers + assign to segments (flat array)
  const companyInputs = competitors.map(name => {
    const real = realByName.get(name.toLowerCase())
    return {
      name,
      description: real?.description?.slice(0, 80) ?? null,
      headcount:   real?.headcount  ?? null,
      location:    real?.location   ?? null,
      website:     real?.website    ?? null,
      linkedin:    real?.linkedin   ?? null,
    }
  })

  const tieredRaw = await callHaiku(
    LANDSCAPE_COMPANY_SYSTEM,
    `Focal company: "${companyName}"
Sector: ${structure.sector}

Segments (use these exact segment_id values):
${JSON.stringify(structure.segments.map(sg => ({ id: sg.id, name: sg.name })), null, 1)}

Companies to categorize:
${JSON.stringify(companyInputs.slice(0, 12), null, 1)}`,
    5500,
  )

  type TieredCompany = Company & { segment_id?: string }
  const tiered = parseJsonArray(tieredRaw) as TieredCompany[]

  // Final overlay: enforce real DB website/linkedin over Claude's generated values
  // Companies NOT found in our verified DB are excluded entirely — no hallucinated websites
  const verifiedTiered = tiered
    .map(c => {
      const real = realByName.get(c.name.toLowerCase())
      if (!real?.website) return null   // exclude unverified companies
      return {
        ...c,
        website:         real.website,
        linkedin:        real.linkedin  ?? c.linkedin,
        headcount_range: real.headcount ?? c.headcount_range,
        hq:              real.location  ?? c.hq,
      }
    })
    .filter((c): c is TieredCompany => c !== null)

  // Distribute companies into segments
  const segments: Segment[] = structure.segments.map(seg => ({
    ...seg,
    companies: verifiedTiered
      .filter(c => c.segment_id === seg.id)
      .map(({ segment_id: _sid, ...c }) => c as Company),
  }))

  // Any company without a valid segment_id goes into the first segment
  const assignedIds = new Set(verifiedTiered.filter(c => c.segment_id).map(c => c.name))
  const unassigned = verifiedTiered.filter(c => !assignedIds.has(c.name))
  if (unassigned.length > 0 && segments.length > 0) {
    segments[0].companies.push(...unassigned.map(({ segment_id: _sid, ...c }) => c as Company))
  }

  return {
    sector:           structure.sector,
    summary:          structure.summary,
    last_updated:     structure.last_updated,
    total_market_size: structure.total_market_size,
    segments,
    white_spaces:     structure.white_spaces  ?? [],
    key_trends:       structure.key_trends    ?? [],
    notable_exits:    structure.notable_exits ?? [],
    data_sources:     structure.data_sources  ?? [],
    is_company_search: true,
    focal_company:    structure.focal_company ?? companyName,
  }
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

  // Build lookup to re-enforce real DB values after Claude enriches
  const dbByName = new Map(candidates.map(c => [c.name.toLowerCase(), c]))

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
  const companies: Company[] = parsed[0]?.companies
    ? parsed.flatMap((seg: { companies: Company[] }) => seg.companies ?? [])
    : parsed

  // Re-enforce real DB website/linkedin — drop any company not in our verified DB
  return companies
    .map(c => {
      const real = dbByName.get(c.name.toLowerCase())
      if (!real?.website) return null   // exclude unverified companies
      return {
        ...c,
        website:         real.website,
        linkedin:        real.linkedin  ?? c.linkedin,
        headcount_range: real.headcount ?? c.headcount_range,
        hq:              real.location  ?? c.hq,
      }
    })
    .filter((c): c is Company => c !== null)
}
