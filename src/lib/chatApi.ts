import { MarketMap } from '../types/marketMap'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string
const MODEL   = 'claude-sonnet-4-5'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

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

  return `You are an expert market intelligence analyst and investment advisor with deep knowledge of the ${map.sector} market.

You have access to the following market map data:

SECTOR: ${map.sector}
SUMMARY: ${map.summary}
MARKET SIZE: ${map.total_market_size}

COMPANIES:
${JSON.stringify(companies, null, 2)}

WHITE SPACES:
${map.white_spaces.map((w, i) => `${i + 1}. ${w}`).join('\n')}

KEY TRENDS:
${map.key_trends.map(t => `- ${t.title}: ${t.description}`).join('\n')}

Answer questions about these companies concisely and insightfully. When assessing investment potential, consider: funding stage, momentum signal, differentiator strength, investor quality, customer traction, and market positioning. Be direct and opinionated — give real analysis, not generic advice. Keep responses focused and under 300 words unless a detailed comparison is requested. Use markdown formatting for clarity.`
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
