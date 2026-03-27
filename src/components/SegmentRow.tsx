import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Segment, Company } from '../types/marketMap'
import CompanyCard from './CompanyCard'

interface Props {
  segment: Segment
  sector: string
  onCompanyClick: (company: Company) => void
  watchlistIds?: Set<string>
  onToggleWatchlist?: (company: Company) => void
  stageFilter?: string[]
  headcountFilter?: string[]
  hqFilter?: string[]
  momentumFilter?: string[]
  foundedFilter?: string[]
  investorFilter?: string[]
  companySearch?: string
  dealFlowMap?: Record<string, string>
  onAskAI?: (company: Company) => void
  scoresMap?: Record<string, number>
  trackingMap?: Record<string, 'viewed' | 'targeted'>
}

const FOUNDED_RANGES: Record<string, (y: number) => boolean> = {
  'Before 2000': y => y < 2000,
  '2000–2009':   y => y >= 2000 && y <= 2009,
  '2010–2014':   y => y >= 2010 && y <= 2014,
  '2015–2019':   y => y >= 2015 && y <= 2019,
  '2020–2022':   y => y >= 2020 && y <= 2022,
  '2023+':       y => y >= 2023,
}

export default function SegmentRow({ segment, sector, onCompanyClick, watchlistIds, onToggleWatchlist, stageFilter, headcountFilter, hqFilter, momentumFilter, foundedFilter, investorFilter, companySearch, dealFlowMap, onAskAI, scoresMap, trackingMap }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const navigate = useNavigate()

  const EARLY_STAGES = ['Pre-Seed', 'Seed', 'Series A']
  const q = companySearch?.toLowerCase().trim() ?? ''
  const companies = segment.companies.filter(c => {
    if (stageFilter && stageFilter.length > 0) {
      const expanded = stageFilter.flatMap(f => f === 'Early Stage' ? EARLY_STAGES : [f])
      if (!expanded.includes(c.stage ?? '')) return false
    }
    if (headcountFilter && headcountFilter.length > 0 && !headcountFilter.includes(c.headcount_range ?? '')) return false
    if (hqFilter && hqFilter.length > 0 && !hqFilter.includes(c.hq ?? '')) return false
    if (momentumFilter && momentumFilter.length > 0 && !momentumFilter.includes(c.momentum_signal ?? '')) return false
    if (investorFilter && investorFilter.length > 0 && !c.investors?.some(inv => investorFilter.includes(inv))) return false
    if (foundedFilter && foundedFilter.length > 0 && c.founded) {
      if (!foundedFilter.some(f => FOUNDED_RANGES[f]?.(c.founded!))) return false
    }
    if (q && !c.name.toLowerCase().includes(q) && !c.tagline?.toLowerCase().includes(q)) return false
    return true
  })

  if (companies.length === 0) return null

  return (
    <div className="mb-12">
      {/* Segment header */}
      <div
        className="flex items-center gap-4 mb-5 pb-3 border-b border-terrain-border pl-3"
        style={{ borderLeftColor: segment.color, borderLeftWidth: 3 }}
      >
        <button
          onClick={() => setIsCollapsed(c => !c)}
          className="flex items-center gap-4 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          aria-expanded={!isCollapsed}
        >
          <span className="text-terrain-muted text-xs font-mono shrink-0 w-3 text-center">
            {isCollapsed ? '▸' : '▾'}
          </span>
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: segment.color }}
          />
          <div className="min-w-0">
            <h3 className="font-display text-xl font-bold text-terrain-text">
              {segment.name}
            </h3>
            <p className="text-terrain-muted text-xs font-mono mt-0.5 truncate">
              {segment.description}
            </p>
          </div>
        </button>
        <span
          className="ml-auto shrink-0 text-xs font-mono px-2.5 py-0.5 rounded-full border"
          style={{
            color: segment.color,
            borderColor: segment.color + '50',
            backgroundColor: segment.color + '18',
          }}
        >
          {companies.length}
        </span>
      </div>

      {/* Companies grid — hidden when collapsed */}
      {!isCollapsed && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {companies.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                onSelect={onCompanyClick}
                isWatchlisted={watchlistIds?.has(company.id)}
                onToggleWatchlist={onToggleWatchlist}
                dealStatus={dealFlowMap?.[company.id]}
                onAskAI={onAskAI}
                score={scoresMap?.[company.id]}
                trackingStatus={trackingMap?.[company.id]}
              />
            ))}
          </div>

          {/* View all */}
          <div className="mt-5">
            <button
              onClick={() => navigate('/segment', { state: { sector, segmentName: segment.name, segmentDescription: segment.description, segmentColor: segment.color } })}
              className="flex items-center gap-2 px-4 py-2 bg-terrain-surface border border-terrain-border rounded text-xs font-mono text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder transition-colors"
            >
              View all companies in {segment.name} →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
