import { Segment, Company } from '../types/marketMap'
import CompanyCard from './CompanyCard'

interface Props {
  segment: Segment
  onCompanyClick: (company: Company) => void
  watchlistIds?: Set<string>
  onToggleWatchlist?: (company: Company) => void
}

export default function SegmentRow({ segment, onCompanyClick, watchlistIds, onToggleWatchlist }: Props) {
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
          {segment.companies.length}
        </span>
      </div>

      {/* Companies grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {segment.companies.map(company => (
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
