export type Recommendation = 'strong_pick' | 'pick' | 'watch' | 'pass'

export interface Founder {
  name?: string
  title?: string
  background?: string
  linkedinUrl?: string
}

export interface ProspectCompany {
  harmonicId?: string
  name: string
  domain?: string
  website?: string
  description?: string
  sector?: string
  stage?: string
  location?: string
  foundedYear?: number
  employeeCount?: number
  employeeGrowth3m?: number
  totalRaisedUsd?: number
  lastRoundAmountUsd?: number
  lastRoundDate?: string
  investors?: string[]
  founders?: Founder[]
  rawSource?: Record<string, unknown>
}

export interface ProspectScore {
  mqs: number
  mus: number
  combinedScore: number
  recommendation: Recommendation
  muckerLens: {
    whyMucker: string[]
    mainRisks: string[]
    suggestedNextStep: string
  }
}
