import { Segment, Company } from '../types/marketMap'
import CompanyCard from './CompanyCard'

interface Props {
  segment: Segment
  onCompanyClick: (company: Company) => void
  watchlistIds?: Set<string>
  onToggleWatchlist?: (company: Company) => void
  stageFilter?: string | null
  headcountFilter?: string | null
  companySearch?: string
}

export default function SegmentRow({ segment, onCompanyClick, watchlistIds, onToggleWatchlist, stageFilter, headcountFilter, companySearch }: Props) {
  const q = companySearch?.toLowerCase().trim() ?? ''
  const companies = segment.companies.filter(c => {
    if (stageFilter && c.stage !== stageFilter) return false
    if (headcountFilter && c.headcount_range !== headcountFilter) return false
    if (q && !c.name.toLowerCase().includes(q) && !c.tagline?.toLowerCase().includes(q)) return false
    return true
  })

  if (companies.length === 0) return null

  return (
    <div className="mb-12">
      {/* Segment header */}
      <div className="flex items-center gap-4 mb-5 pb-3 border-b border-terrain-border">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: segment.color }}
        />
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-terrain-text">
            {segment.name}
          </h3>
          <p className="text-terrain-muted text-xs font-mono mt-0.5 truncate">
            {segment.description}
          </p>
        </div>
        <span className="ml-auto shrink-0 text-terrain-muted text-xs font-mono border border-terrain-border px-2 py-0.5 rounded">
          {companies.length}
        </span>
      </div>

      {/* Companies grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {companies.map(company => (
          <CompanyCard
            key={company.id}
            company={company}
            onSelect={onCompanyClick}
            isWatchlisted={watchlistIds?.has(company.id)}
            onToggleWatchlist={onToggleWatchlist}
          />
        ))}
      </div>
    </div>
  )
}
