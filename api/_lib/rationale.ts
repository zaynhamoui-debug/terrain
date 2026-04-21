import type { ProspectCompany, ProspectScore } from './types'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ''

interface CompanyInput {
  company: ProspectCompany
  score: ProspectScore
}

/**
 * Batch-generates why_mucker rationale for up to 20 companies in a single Haiku call.
 * Returns a map of company name → rationale string.
 */
export async function generateRationalesBatch(items: CompanyInput[]): Promise<Map<string, string>> {
  if (!ANTHROPIC_API_KEY || items.length === 0) return new Map()

  const list = items.map(({ company, score }, i) => ({
    idx: i + 1,
    name: company.name,
    description: (company.description ?? '').slice(0, 200),
    stage: company.stage,
    location: company.location,
    sector: company.sector,
    mqs: score.mqs,
    mus: score.mus,
    fit: score.combinedScore,
    why: score.muckerLens.whyMucker.join(' '),
    risks: score.muckerLens.mainRisks[0] ?? '',
  }))

  const prompt = `You are a Mucker Capital analyst. For each company below, write exactly 2 sentences explaining why it fits Mucker's investment thesis (pre-seed/seed B2B software, urgency, PMF signals, moat). Be specific — cite the sector, stage, and one concrete signal. Do NOT mention the scores.

Companies:
${JSON.stringify(list, null, 2)}

Return ONLY a JSON array of objects, one per company, in the same order:
[{ "idx": 1, "rationale": "..." }, ...]`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return new Map()

    const data = await res.json() as { content?: Array<{ type: string; text: string }> }
    const text = data.content?.find(b => b.type === 'text')?.text ?? ''
    const start = text.indexOf('[')
    const end   = text.lastIndexOf(']')
    if (start === -1 || end <= start) return new Map()

    const parsed = JSON.parse(text.slice(start, end + 1)) as Array<{ idx: number; rationale: string }>
    const map = new Map<string, string>()
    for (const { idx, rationale } of parsed) {
      const item = items[idx - 1]
      if (item) map.set(item.company.name, rationale)
    }
    return map
  } catch {
    return new Map()
  }
}
