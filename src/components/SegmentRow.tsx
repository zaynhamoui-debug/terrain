import { useState } from 'react'
import { Segment, Company } from '../types/marketMap'
import CompanyCard from './CompanyCard'

interface Props {
  segment: Segment
  onCompanyClick: (company: Company) => void
  watchlistIds?: Set<string>
  onToggleWatchlist?: (company: Company) => void
  stageFilter?: string | null
  headcountFilter?: string | null
  hqFilter?: string | null
  momentumFilter?: string | null
  foundedFilter?: string | null
  investorFilter?: string | null
  companySearch?: string
  onLoadMore?: () => void
  isLoadingMore?: boolean
  loadMoreError?: string | null
  dealFlowMap?: Record<string, string>
  onAskAI?: (company: Company) => void
}

const FOUNDED_RANGES: Record<string, (y: number) => boolean> = {
  'Before 2000': y => y < 2000,
  '2000–2009':   y => y >= 2000 && y <= 2009,
  '2010–2014':   y => y >= 2010 && y <= 2014,
  '2015–2019':   y => y >= 2015 && y <= 2019,
  '2020–2022':   y => y >= 2020 && y <= 2022,
  '2023+':       y => y >= 2023,
}

export default function SegmentRow({ segment, onCompanyClick, watchlistIds, onToggleWatchlist, stageFilter, headcountFilter, hqFilter, momentumFilter, foundedFilter, investorFilter, companySearch, onLoadMore, isLoadingMore, loadMoreError, dealFlowMap, onAskAI }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const q = companySearch?.toLowerCase().trim() ?? ''
  const companies = segment.companies.filter(c => {
    if (stageFilter === 'Early Stage') {
      if (!['Pre-Seed', 'Seed', 'Series A'].includes(c.stage ?? '')) return false
    } else if (stageFilter && c.stage !== stageFilter) return false
    if (headcountFilter && c.headcount_range !== headcountFilter) return false
    if (hqFilter && c.hq !== hqFilter) return false
    if (momentumFilter && c.momentum_signal !== momentumFilter) return false
    if (investorFilter && !c.investors?.includes(investorFilter)) return false
    if (foundedFilter && c.founded) {
      const test = FOUNDED_RANGES[foundedFilter]
      if (test && !test(c.founded)) return false
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
              />
            ))}
          </div>

          {/* Load more */}
          {onLoadMore && (
            <div className="mt-5 flex items-center gap-4">
              <button
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-4 py-2 bg-terrain-surface border border-terrain-border rounded text-xs font-mono text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder transition-colors disabled:opacity-40"
              >
                {isLoadingMore ? (
                  <>
                    <span className="w-3 h-3 border border-terrain-muted border-t-terrain-gold rounded-full animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>+ Load 20 more companies</>
                )}
              </button>
              <span className="text-terrain-muted text-[10px] font-mono">
                {segment.companies.length} loaded
              </span>
              {loadMoreError && (
                <span className="text-red-400 text-[10px] font-mono">Error: {loadMoreError}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
