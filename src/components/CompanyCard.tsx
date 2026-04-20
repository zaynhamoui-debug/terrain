import { Company } from '../types/marketMap'

/** Normalise a website value that may or may not already contain a protocol. */
function toWebsiteHref(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `https://${value}`
}

/** Normalise a LinkedIn value that may be a full URL, a path, or just a slug. */
function toLinkedInHref(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('linkedin.com')) return `https://${value}`
  if (value.startsWith('/company/') || value.startsWith('company/')) {
    return `https://www.linkedin.com/${value.replace(/^\//, '')}`
  }
  return `https://www.linkedin.com/company/${value}`
}

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

// Score 1 = red (hue 0), Score 10 = green (hue 120)
export function scoreToColor(score: number): string {
  const hue = Math.round(((score - 1) / 9) * 120)
  return `hsl(${hue}, 65%, 45%)`
}

function scoreStyle(score: number): React.CSSProperties {
  const hue = Math.round(((score - 1) / 9) * 120)
  return {
    borderColor: `hsl(${hue}, 60%, 30%)`,
    boxShadow: `0 0 0 1px hsl(${hue}, 60%, 20%), inset 0 0 20px hsl(${hue}, 60%, 5%)`,
  }
}

interface Props {
  company: Company
  onSelect: (company: Company) => void
  isWatchlisted?: boolean
  onToggleWatchlist?: (company: Company) => void
  dealStatus?: string
  onAskAI?: (company: Company) => void
  score?: number
  trackingStatus?: 'viewed' | 'targeted'
}

export default function CompanyCard({ company, onSelect, isWatchlisted, onToggleWatchlist, dealStatus, onAskAI, score, trackingStatus }: Props) {
  const stageClass = STAGE_STYLES[company.stage] ?? 'bg-slate-900 text-slate-400 border-slate-700'
  const momentum   = company.momentum_signal?.split(' ')[0] ?? ''
  const dealInfo   = dealStatus ? DEAL_STATUS_STYLES[dealStatus] : null

  const hasScore = score !== undefined && score !== null
  const borderStyle = hasScore && !company.is_focal_company ? scoreStyle(score) : {}

  return (
    <button
      onClick={() => onSelect(company)}
      style={borderStyle}
      className={`group relative text-left w-full p-4 rounded-lg border transition-all duration-200 hover:shadow-lg ${
        company.is_focal_company
          ? 'border-terrain-gold bg-terrain-goldDim hover:border-terrain-gold/70 border-l-2'
          : hasScore
            ? 'border bg-terrain-surface hover:brightness-110'
            : 'border-terrain-border bg-terrain-surface hover:border-terrain-subtle'
      } ${trackingStatus === 'viewed' ? 'opacity-70' : ''}`}
    >
      {/* Top-right actions */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {/* Score badge */}
        {hasScore && (
          <span
            className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded"
            style={{ color: scoreToColor(score), backgroundColor: `hsl(${Math.round(((score - 1) / 9) * 120)}, 60%, 8%)`, border: `1px solid hsl(${Math.round(((score - 1) / 9) * 120)}, 60%, 20%)` }}
          >
            {score}/10
          </span>
        )}
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

      {/* Tracking + deal flow badges row */}
      {(dealInfo || trackingStatus) && (
        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
          {dealInfo && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${dealInfo.cls}`}>
              {dealInfo.label}
            </span>
          )}
          {trackingStatus === 'targeted' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border font-mono bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold">
              ⊙ Targeted
            </span>
          )}
          {trackingStatus === 'viewed' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border font-mono bg-terrain-surface border-terrain-border text-terrain-muted">
              ✓ Viewed
            </span>
          )}
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
          {toWebsiteHref(company.website) && (
            <a
              href={toWebsiteHref(company.website)!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="hover:text-terrain-gold transition-colors"
              title="Website"
            >
              ↗
            </a>
          )}
          {toLinkedInHref(company.linkedin) && (
            <a
              href={toLinkedInHref(company.linkedin)!}
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
        <div className="mt-2 pt-2 border-t border-terrain-border opacity-0 group-hover:opacity-100 transition-all duration-200">
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onAskAI(company) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onAskAI(company) } }}
            className="text-[9px] font-mono text-terrain-muted border border-terrain-border px-2 py-0.5 rounded hover:text-terrain-gold hover:border-terrain-goldBorder transition-colors cursor-pointer"
          >
            Ask AI ✦
          </span>
        </div>
      )}
    </button>
  )
}
