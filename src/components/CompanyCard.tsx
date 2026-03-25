import { Company } from '../types/marketMap'

const STAGE_STYLES: Record<string, string> = {
  'Pre-Seed':  'bg-slate-900  text-slate-400  border-slate-700',
  'Seed':      'bg-emerald-950 text-emerald-400 border-emerald-800',
  'Series A':  'bg-blue-950   text-blue-400   border-blue-800',
  'Series B':  'bg-violet-950 text-violet-400  border-violet-800',
  'Series C':  'bg-orange-950 text-orange-400  border-orange-800',
  'Series D+': 'bg-red-950    text-red-400     border-red-800',
  'Public':    'bg-yellow-950 text-yellow-400  border-yellow-800',
  'Acquired':  'bg-stone-900  text-stone-400   border-stone-700',
  'Bootstrapped': 'bg-teal-950 text-teal-400  border-teal-800',
}

interface Props {
  company: Company
  onSelect: (company: Company) => void
  isWatchlisted?: boolean
  onToggleWatchlist?: (company: Company) => void
}

export default function CompanyCard({ company, onSelect, isWatchlisted, onToggleWatchlist }: Props) {
  const stageClass = STAGE_STYLES[company.stage] ?? 'bg-slate-900 text-slate-400 border-slate-700'
  const momentum   = company.momentum_signal?.split(' ')[0] ?? ''

  return (
    <button
      onClick={() => onSelect(company)}
      className={`group relative text-left w-full p-5 rounded-lg border transition-all duration-150 hover:translate-y-[-1px] ${
        company.is_focal_company
          ? 'border-terrain-gold bg-terrain-goldDim hover:border-terrain-gold/70'
          : 'border-terrain-border bg-terrain-surface hover:border-terrain-subtle'
      }`}
    >
      {/* Top-right actions */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {company.is_focal_company && (
          <span className="text-terrain-gold text-xs opacity-80">★ focal</span>
        )}
        {onToggleWatchlist && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onToggleWatchlist(company) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onToggleWatchlist(company) } }}
            className={`text-base leading-none cursor-pointer transition-colors ${
              isWatchlisted ? 'text-terrain-gold' : 'text-terrain-muted hover:text-terrain-gold'
            }`}
            title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatchlisted ? '♥' : '♡'}
          </span>
        )}
      </div>

      {/* Name + tagline */}
      <div className="mb-3 pr-12">
        <h4 className="font-display font-semibold text-terrain-text leading-tight truncate group-hover:text-terrain-gold transition-colors">
          {company.name}
        </h4>
        <p className="text-terrain-muted text-xs mt-0.5 line-clamp-2 leading-relaxed font-mono">
          {company.tagline}
        </p>
      </div>

      {/* Stage + funding row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${stageClass}`}>
          {company.stage}
        </span>
        {company.funding_display && company.funding_display !== '$0' && (
          <span className="text-terrain-gold text-xs font-bold font-mono">
            {company.funding_display}
          </span>
        )}
        {momentum && (
          <span className="ml-auto text-base" title={company.momentum_signal}>
            {momentum}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 text-[11px] text-terrain-muted font-mono">
        <span className="truncate">{company.hq}</span>
        {company.founded ? <span className="shrink-0">est. {company.founded}</span> : null}
      </div>
    </button>
  )
}
