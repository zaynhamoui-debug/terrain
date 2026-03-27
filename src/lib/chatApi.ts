import { MarketMap, Company } from '../types/marketMap'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string
const MODEL   = 'claude-sonnet-4-6'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const MUCKER_PERSONA = `You are a General Partner at Mucker Capital, an LA-based venture capital firm that leads pre-seed, seed, and Series A investments. Your mandate is to proactively scout, evaluate, and surface startup investment opportunities that match Mucker Capital's strategy and underwriting standards.

Mucker Capital Investment Criteria:
1. PROBLEM & ICP: Only consider startups solving a severely felt pain (urgent, frequent, expensive if unsolved) with a clearly defined ICP and demonstrable willingness-to-pay. Reject vague problems or unclear ICPs.
2. MARKET & EXIT: Require a credible path to $1B+ exit via bottoms-up TAM. Multiple strategic acquirers required. Reject niche markets or single-buyer exit risk.
3. TEAM QUALITY: Prioritize data-driven execution, high product velocity, customer obsession, strong GTM, and ability to recruit. Avoid vision-without-execution teams.
4. COMPETITIVE LANDSCAPE: Strongly prefer non-hyped, non-crowded markets with no dominant incumbent. "One-of-one" companies are ideal. Reject head-to-head with well-funded incumbents.
5. TRACTION: Require ≥2× YoY growth (or on track), increasing net new revenue, 70%+ gross margins, early PMF signals. Treat vanity metrics as weak signals.
6. CAPITAL EFFICIENCY: Evaluate burn multiple, CAC payback, LTV:CAC. Reject growth primarily from unsustainable burn.
7. DEAL FIT: Check size $1–5M, target ~20% ownership, post-money $5–25M. Flag misalignment clearly.

Be skeptical, precise, and opinionated. Optimize for quality over quantity.`

function buildSystemPrompt(map: MarketMap): string {
  const companies = map.segments.flatMap(s =>
    s.companies.map(c => ({
      name: c.name,
      segment: s.name,
      tagline: c.tagline,
      stage: c.stage,
      funding: c.funding_display,
      valuation: c.valuation_display,
      founded: c.founded,
      hq: c.hq,
      headcount: c.headcount_range,
      differentiator: c.differentiator,
      momentum: c.momentum_signal,
      investors: c.investors,
      key_customers: c.key_customers,
      last_round: c.last_round,
    }))
  )

  return `${MUCKER_PERSONA}

You have access to the following market map data for the ${map.sector} sector:

MARKET SIZE: ${map.total_market_size}
SUMMARY: ${map.summary}

COMPANIES (${companies.length} total):
${JSON.stringify(companies, null, 2)}

WHITE SPACES:
${map.white_spaces.map((w, i) => `${i + 1}. ${w}`).join('\n')}

KEY TRENDS:
${map.key_trends.map(t => `- ${t.title}: ${t.description}`).join('\n')}

Answer questions about these companies with the lens of a Mucker Capital GP. For Series B+ or public companies, treat them as market context/comparables — not direct investment targets. Be direct and opinionated. Give real analysis, not generic advice. Keep responses focused and under 300 words unless a detailed comparison is requested. Use markdown formatting.`
}

export async function sendChatMessage(
  map: MarketMap,
  messages: ChatMessage[]
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                                 API_KEY,
      'anthropic-version':                         '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type':                              'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 1024,
      system:     buildSystemPrompt(map),
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`
    )
  }

  const data = await res.json()
  return data.content.find((b: { type: string }) => b.type === 'text')?.text ?? ''
}

export async function generateInvestmentMemo(company: Company, sector: string): Promise<string> {
  const isEarlyStage = ['Pre-Seed', 'Seed', 'Series A'].includes(company.stage ?? '')

  const systemPrompt = `${MUCKER_PERSONA}

Generate investment memos in the Mucker Capital style: direct, skeptical, data-driven. Structure every memo with the exact sections below. Be specific — avoid generic statements. Give a clear Invest / Watch / Pass verdict with explicit reasoning tied to Mucker's criteria.`

  const prompt = `Write a Mucker Capital investment memo for **${company.name}** in the ${sector} market.
${!isEarlyStage ? '\n> ⚠️ This company is beyond Mucker\'s typical stage — evaluate fit and flag valuation/ownership implications.\n' : ''}
Use this exact structure:

**PROBLEM & ICP**
[Is the problem urgent, frequent, and expensive? Who is the precise ICP? Is there clear willingness-to-pay evidence?]

**PRODUCT & DIFFERENTIATION**
[What do they build? What is the actual moat? Is this a one-of-one position or a crowded category?]

**MARKET SIZE (BOTTOMS-UP TAM)**
[ICP count × realistic ACV = TAM. Is there a credible path to $1B+ exit? Name 2-3 strategic acquirers.]

**COMPETITIVE LANDSCAPE**
[Who are direct competitors? Are there dominant incumbents? Is this market hyped or non-obvious?]

**TRACTION & KEY METRICS**
[Revenue growth, retention, NRR, gross margins if knowable. Are metrics showing PMF signals?]

**CAPITAL EFFICIENCY**
[Burn multiple, CAC payback, LTV:CAC signals. Is growth disciplined or burn-driven?]

**FOUNDER & TEAM**
[What signals exist about execution ability, domain expertise, GTM strength, and recruiting?]

**EXIT PATHS & COMPS**
[IPO potential, PE buyout, strategic acquirers. Comp multiples supporting $1B+ outcome.]

**RISKS & OPEN QUESTIONS**
- [Risk 1]
- [Risk 2]
- [Risk 3]

**DEAL STRUCTURE FIT**
[Does this fit $1-5M check, ~20% ownership, $5-25M post-money? Flag misalignment.]

**VERDICT: [INVEST / WATCH / PASS]**
[2-3 sentences. Be direct. State the primary reason.]

Company data:
Stage: ${company.stage} | Funding: ${company.funding_display} | Valuation: ${company.valuation_display}
Founded: ${company.founded} | HQ: ${company.hq} | Headcount: ${company.headcount_range}
Momentum: ${company.momentum_signal} | Last Round: ${company.last_round}
Tagline: ${company.tagline}
Differentiator: ${company.differentiator}
Investors: ${(company.investors ?? []).join(', ') || 'Unknown'}
Key Customers: ${(company.key_customers ?? []).join(', ') || 'Unknown'}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                                 API_KEY,
      'anthropic-version':                         '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type':                              'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 2000,
      system:     systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`
    )
  }

  const data = await res.json()
  return data.content.find((b: { type: string }) => b.type === 'text')?.text ?? ''
}

export async function detectRedFlags(company: Company, sector: string): Promise<string> {
  const systemPrompt = `${MUCKER_PERSONA}

Identify red flags with the discipline of a GP doing pre-term-sheet diligence. Be blunt. Prioritize flags that would cause Mucker Capital to pass. No softening language.`

  const prompt = `Identify 4-6 red flags for **${company.name}** (${sector}) from a Mucker Capital GP perspective.

For each flag, state: the concern, why it matters to Mucker specifically, and what evidence would need to exist to overcome it.

Focus on Mucker's specific kill criteria:
- Weak or absent willingness-to-pay signals
- Vague ICP or problem definition
- No credible $1B+ exit path (niche TAM or no strategic acquirers)
- Crowded market or dominant well-funded incumbent
- Stage mismatch (Series B+ = flag ownership/check size)
- Growth driven by burn, not product-market fit
- No clear competitive moat or "one-of-one" position
- Momentum signal concerns (⚠️ Challenged = likely pass)

Return as a concise bulleted list. No preamble or summary.

Company: ${company.stage} | ${company.funding_display} | ${company.headcount_range} employees | Founded ${company.founded}
Momentum: ${company.momentum_signal} | HQ: ${company.hq}
Tagline: ${company.tagline}
Differentiator: ${company.differentiator}
Investors: ${(company.investors ?? []).join(', ') || 'Unknown'}
Last Round: ${company.last_round}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                                 API_KEY,
      'anthropic-version':                         '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type':                              'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 700,
      system:     systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`
    )
  }

  const data = await res.json()
  return data.content.find((b: { type: string }) => b.type === 'text')?.text ?? ''
}
