import type { ProspectCompany } from './types'

export class HarmonicClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(apiKey: string, baseUrl = 'https://api.harmonic.ai') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async fetchSavedSearchCompanies(savedSearchId: number): Promise<ProspectCompany[]> {
    const res = await fetch(`${this.baseUrl}/saved_searches/${savedSearchId}/results`, {
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

    const payload = await res.json()
    return normalizeHarmonicPayload(payload, savedSearchId)
  }
}

function normalizeHarmonicPayload(payload: unknown, savedSearchId: number): ProspectCompany[] {
  // Harmonic may return { companies: [...] }, { results: [...] }, or a bare array
  const raw = payload as Record<string, unknown>
  const rows: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.companies)  ? raw.companies  as unknown[]
    : Array.isArray(raw.results)    ? raw.results    as unknown[]
    : Array.isArray(raw.data)       ? raw.data       as unknown[]
    : []

  return rows
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map(row => {
      // Harmonic nests company details under `company` or at the top level
      const c = (typeof row.company === 'object' && row.company !== null)
        ? row.company as Record<string, unknown>
        : row

      return {
        harmonicId:          String(c.id ?? c.harmonic_id ?? c.urn ?? ''),
        name:                String(c.name ?? ''),
        domain:              c.website_domain ? String(c.website_domain) : undefined,
        website:             c.website_url   ? String(c.website_url)   : undefined,
        description:         c.description   ? String(c.description)   : undefined,
        sector:              c.industry      ? String(c.industry)      : undefined,
        stage:               c.funding_stage ? String(c.funding_stage) : undefined,
        location:            c.location?.city
          ? `${c.location.city}, ${(c.location as Record<string,unknown>).state ?? ''}`
          : c.headquarters ? String(c.headquarters) : undefined,
        foundedYear:         typeof c.founding_date === 'number' ? c.founding_date : undefined,
        employeeCount:       typeof c.headcount === 'number' ? c.headcount : undefined,
        employeeGrowth3m:    typeof c.headcount_growth?.['3_months'] === 'number'
          ? (c.headcount_growth as Record<string,unknown>)['3_months'] as number : undefined,
        totalRaisedUsd:      typeof c.funding_total === 'number' ? c.funding_total : undefined,
        lastRoundAmountUsd:  typeof c.last_funding_amount === 'number' ? c.last_funding_amount : undefined,
        lastRoundDate:       c.last_funding_date ? String(c.last_funding_date) : undefined,
        investors:           Array.isArray(c.investors)
          ? (c.investors as unknown[]).map(i => typeof i === 'string' ? i : String((i as Record<string,unknown>).name ?? '')).filter(Boolean)
          : [],
        founders:            Array.isArray(c.founders)
          ? (c.founders as unknown[]).map(f => {
              const fo = f as Record<string, unknown>
              return { name: String(fo.name ?? ''), title: String(fo.title ?? ''), background: String(fo.bio ?? fo.background ?? '') }
            })
          : [],
        rawSource: { savedSearchId, harmonic: row },
      }
    })
    .filter(c => c.name)
}
