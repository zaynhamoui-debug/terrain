export type Stage =
  | 'Pre-Seed' | 'Seed' | 'Series A' | 'Series B'
  | 'Series C' | 'Series D+' | 'Public' | 'Acquired' | 'Bootstrapped'

export type MomentumSignal =
  | '🚀 Hypergrowth' | '📈 Growing' | '➡️ Stable' | '⚠️ Challenged' | '🔒 Stealth'

export interface Company {
  id: string
  name: string
  tagline: string
  founded: number
  stage: Stage
  total_funding_usd: number
  funding_display: string
  last_round: string
  valuation_display: string
  headcount_range: string
  hq: string
  website: string
  linkedin: string
  differentiator: string
  key_customers: string[]
  investors: string[]
  momentum_signal: MomentumSignal
  is_focal_company: boolean
}

export interface Segment {
  id: string
  name: string
  description: string
  color: string
  companies: Company[]
}

export interface KeyTrend {
  title: string
  description: string
}

export interface NotableExit {
  company: string
  acquirer_or_ipo: string
  year: number
  value_display: string
}

export interface MarketMap {
  sector: string
  summary: string
  last_updated: string
  total_market_size: string
  segments: Segment[]
  white_spaces: string[]
  key_trends: KeyTrend[]
  notable_exits: NotableExit[]
  data_sources: string[]
}

export interface SavedMap {
  id: string
  query: string
  map_data?: MarketMap
  created_at: string
}
