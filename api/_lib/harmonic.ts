import type { ProspectCompany } from './types.js'

export class HarmonicClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(apiKey: string, baseUrl = 'https://api.harmonic.ai') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async fetchSavedSearchCompanies(savedSearchId: number): Promise<ProspectCompany[]> {
    const all: ProspectCompany[] = []
    let nextCursor: string | null = null

    // Single page per call — keeps invocation within 60s budget
    for (let page = 0; page < 1; page++) {
      const url = nextCursor
        ? `${this.baseUrl}/savedSearches:results/${savedSearchId}?page_token=${encodeURIComponent(nextCursor)}`
        : `${this.baseUrl}/savedSearches:results/${savedSearchId}`

      const res = await fetch(url, {
        headers: {
          'apikey':       this.apiKey,
          'accept':       'application/json',
          'content-type': 'application/json',
        },
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Harmonic saved search ${savedSearchId} returned ${res.status}: ${body.slice(0, 200)}`)
      }

      const payload = await res.json() as {
        results: HarmonicCompany[]
        page_info: { next: string | null; has_next: boolean }
      }

      const companies = (payload.results ?? []).map(normalizeCompany).filter(c => c.name)
      all.push(...companies)

      if (!payload.page_info?.has_next || !payload.page_info?.next) break
      nextCursor = payload.page_info.next
    }

    return all
  }
}

// ─── Harmonic API shape ───────────────────────────────────────────────────────

interface HarmonicCompany {
  entity_urn?: string
  id?: number
  name?: string
  description?: string
  short_description?: string
  stage?: string
  headcount?: number
  founding_date?: { date?: string }
  website?: { url?: string; domain?: string }
  location?: { city?: string; state?: string; address_formatted?: string }
  funding?: {
    funding_total?: number
    investors?: Array<{ name?: string }>
    funding_rounds?: Array<{
      funding_round_type?: string
      funding_amount?: number
      announcement_date?: string
    }>
  }
  tags?: Array<{ display_value?: string; type?: string; is_primary_tag?: boolean | null }>
  people?: Array<{
    name?: string
    title?: string
    description?: string
    is_current_position?: boolean
  }>
}

function normalizeCompany(c: HarmonicCompany): ProspectCompany {
  const loc = c.location?.city
    ? `${c.location.city}, ${c.location.state ?? ''}`.replace(/, $/, '')
    : c.location?.address_formatted ?? undefined

  // Primary sector from tags
  const primaryTag = c.tags?.find(t => t.is_primary_tag)
    ?? c.tags?.find(t => t.type === 'MARKET_VERTICAL')
    ?? c.tags?.[0]
  const sector = primaryTag?.display_value

  // Founders / key people (current, senior titles only)
  const founders = (c.people ?? [])
    .filter(p => p.is_current_position && /founder|co-founder|ceo|cto/i.test(p.title ?? ''))
    .slice(0, 5)
    .map(p => ({ name: p.name ?? '', title: p.title ?? '', background: p.description ?? '' }))

  // Last funding round (most recent first)
  const rounds = (c.funding?.funding_rounds ?? []).sort((a, b) =>
    (b.announcement_date ?? '').localeCompare(a.announcement_date ?? '')
  )
  const lastRound = rounds[0]

  return {
    harmonicId:          c.entity_urn ?? String(c.id ?? ''),
    name:                c.name ?? '',
    domain:              c.website?.domain              ?? undefined,
    website:             c.website?.url                 ?? undefined,
    description:         c.description ?? c.short_description ?? undefined,
    sector,
    stage:               c.stage                        ?? undefined,
    location:            loc,
    foundedYear:         c.founding_date?.date
      ? new Date(c.founding_date.date).getFullYear()    : undefined,
    employeeCount:       c.headcount                    ?? undefined,
    totalRaisedUsd:      c.funding?.funding_total       ?? undefined,
    lastRoundAmountUsd:  lastRound?.funding_amount      ?? undefined,
    lastRoundDate:       lastRound?.announcement_date?.slice(0, 10) ?? undefined,
    investors:           (c.funding?.investors ?? []).map(i => i.name ?? '').filter(Boolean),
    founders,
    rawSource:           { source: 'harmonic', entity_urn: c.entity_urn },
  }
}
