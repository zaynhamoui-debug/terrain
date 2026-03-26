import { Company } from '../types/marketMap'

export const STAGE_STYLES: Record<string, string> = {
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

const DEAL_STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  watching:      { label: 'Watching',      cls: 'bg-blue-950 text-blue-400 border-blue-800' },
  outreach:      { label: 'Outreach',      cls: 'bg-yellow-950 text-yellow-400 border-yellow-800' },
  meeting:       { label: 'Meeting',       cls: 'bg-orange-950 text-orange-400 border-orange-800' },
  due_diligence: { label: 'Due Diligence', cls: 'bg-violet-950 text-violet-400 border-violet-800' },
  portfolio:     { label: 'Portfolio',     cls: 'bg-green-950 text-green-400 border-green-800' },
  passed:        { label: 'Passed',        cls: 'bg-red-950 text-red-400 border-red-800' },
}

interface Props {
  company: Company
  onSelect: (company: Company) => void
  isWatchlisted?: boolean
  onToggleWatchlist?: (company: Company) => void
  dealStatus?: string
  onAskAI?: (company: Company) => void
}

export default function CompanyCard({ company, onSelect, isWatchlisted, onToggleWatchlist, dealStatus, onAskAI }: Props) {
  const stageClass = STAGE_STYLES[company.stage] ?? 'bg-slate-900 text-slate-400 border-slate-700'
  const momentum   = company.momentum_signal?.split(' ')[0] ?? ''
  const dealInfo   = dealStatus ? DEAL_STATUS_STYLES[dealStatus] : null

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

      {/* Deal flow status badge */}
      {dealInfo && (
        <div className="mb-2">
          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${dealInfo.cls}`}>
            {dealInfo.label}
          </span>
        </div>
      )}

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
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {company.website && (
            <a
              href={`https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="hover:text-terrain-gold transition-colors"
              title="Website"
            >
              ↗
            </a>
          )}
          {company.linkedin && (
            <a
              href={`https://linkedin.com/${company.linkedin}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="hover:text-terrain-gold transition-colors"
              title="LinkedIn"
            >
              in
            </a>
          )}
        </div>
      </div>

      {/* Ask AI button */}
      {onAskAI && (
        <div className="mt-3 pt-3 border-t border-terrain-border">
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onAskAI(company) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onAskAI(company) } }}
            className="text-[10px] font-mono text-terrain-gold border border-terrain-goldBorder bg-terrain-goldDim px-2 py-1 rounded hover:opacity-80 transition-opacity cursor-pointer"
          >
            Ask AI ✦
          </span>
        </div>
      )}
    </button>
  )
}
