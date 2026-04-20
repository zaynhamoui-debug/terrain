import { useState } from 'react'
import {
  RecCompany, FeedbackEntry, FeedbackRating,
  RATING_LABELS, PASS_TAGS, POSITIVE_TAGS,
} from '../lib/dailyRecs'
import { STAGE_STYLES } from './CompanyCard'

interface Props {
  company:    RecCompany
  feedback:   FeedbackEntry | undefined
  onFeedback: (entry: FeedbackEntry) => void
}

const RATING_STYLES: Record<FeedbackRating, { active: string; hover: string; label: string }> = {
  0: { active: 'bg-red-950    border-red-700    text-red-400',    hover: 'hover:border-red-700    hover:text-red-400    hover:bg-red-950/40',    label: 'Pass'       },
  1: { active: 'bg-slate-800  border-slate-600  text-slate-300',  hover: 'hover:border-slate-600  hover:text-slate-300  hover:bg-slate-800/40',  label: 'Watch'      },
  2: { active: 'bg-blue-950   border-blue-700   text-blue-400',   hover: 'hover:border-blue-700   hover:text-blue-400   hover:bg-blue-950/40',   label: 'Interested' },
  3: { active: 'bg-emerald-950 border-emerald-700 text-emerald-400', hover: 'hover:border-emerald-700 hover:text-emerald-400 hover:bg-emerald-950/40', label: 'Strong Yes' },
}

export default function RecCompanyCard({ company, feedback, onFeedback }: Props) {
  const stageClass = STAGE_STYLES[company.stage] ?? 'bg-slate-900 text-slate-400 border-slate-700'

  const websiteHost = (() => {
    try { return new URL(company.website).hostname.replace('www.', '') }
    catch { return company.website }
  })()

  // Local state for the in-progress feedback before saving
  const [pendingRating, setPendingRating] = useState<FeedbackRating | null>(
    feedback?.rating !== undefined ? feedback.rating : null
  )
  const [selectedTags, setSelectedTags] = useState<string[]>(feedback?.tags ?? [])
  const [note, setNote]                 = useState(feedback?.note ?? '')
  const [showNote, setShowNote]         = useState(!!(feedback?.note))

  const activeRating = pendingRating !== null ? pendingRating : feedback?.rating

  function handleRating(r: FeedbackRating) {
    setPendingRating(r)
    // Reset tags when switching rating direction (pass → positive or vice versa)
    const wasNegative = activeRating !== undefined && activeRating < 1
    const isNegative  = r < 1
    if (wasNegative !== isNegative) setSelectedTags([])
    save(r, wasNegative !== isNegative ? [] : selectedTags, note)
  }

  function handleTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]
    setSelectedTags(next)
    if (pendingRating !== null) save(pendingRating, next, note)
  }

  function handleNote(val: string) {
    setNote(val)
    if (pendingRating !== null) save(pendingRating, selectedTags, val)
  }

  function save(r: FeedbackRating, tags: string[], n: string) {
    onFeedback({ rating: r, tags, note: n })
  }

  const isRated       = activeRating !== undefined
  const isNegative    = isRated && activeRating < 1
  const suggestedTags = isNegative ? PASS_TAGS : POSITIVE_TAGS

  return (
    <div className={`bg-terrain-surface border rounded-lg p-5 flex flex-col gap-4 transition-all duration-200 ${
      isRated
        ? activeRating === 3 ? 'border-emerald-800/60'
        : activeRating === 2 ? 'border-blue-800/60'
        : activeRating === 1 ? 'border-slate-600/60'
        : 'border-red-900/60 opacity-80'
        : 'border-terrain-border hover:border-terrain-subtle'
    }`}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-display text-base font-bold text-terrain-text truncate">
              {company.name}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${stageClass}`}>
              {company.stage}
            </span>
            {isRated && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${RATING_STYLES[activeRating as FeedbackRating].active}`}>
                {RATING_LABELS[activeRating as FeedbackRating]}
              </span>
            )}
          </div>
          <p className="text-terrain-muted text-xs font-mono leading-relaxed">{company.tagline}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono text-terrain-muted">
        {company.industry && (
          <span className="px-2 py-0.5 rounded bg-terrain-bg border border-terrain-border">
            {company.industry}
          </span>
        )}
        {company.location && <span>📍 {company.location}</span>}
        {company.founded  && <span>Est. {company.founded}</span>}
      </div>

      {/* Why Mucker */}
      <div className="rounded bg-terrain-bg border border-terrain-goldBorder px-3 py-2.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-terrain-gold mb-1">Why Mucker</p>
        <p className="text-xs font-mono text-terrain-text/80 leading-relaxed">{company.why_mucker}</p>
      </div>

      {/* Links */}
      <div className="flex items-center gap-3 border-t border-terrain-border pt-3">
        <a
          href={company.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-mono text-terrain-muted hover:text-terrain-gold transition-colors"
        >
          <span className="text-terrain-gold">↗</span>
          {websiteHost}
        </a>
        {company.linkedin && (
          <a
            href={company.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-mono text-terrain-muted hover:text-terrain-gold transition-colors"
          >
            <span className="text-terrain-gold">in</span>
            LinkedIn
          </a>
        )}
      </div>

      {/* ── Rating row ── */}
      <div className="border-t border-terrain-border pt-3 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-terrain-muted uppercase tracking-widest mr-1">Rate</span>
          {([0, 1, 2, 3] as FeedbackRating[]).map(r => {
            const s       = RATING_STYLES[r]
            const isActive = activeRating === r
            return (
              <button
                key={r}
                onClick={() => handleRating(r)}
                className={`px-2.5 py-1 rounded border text-[11px] font-mono transition-all duration-150 ${
                  isActive ? s.active : `border-terrain-border text-terrain-muted ${s.hover}`
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Tags — shown after a rating is selected */}
        {isRated && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-terrain-muted uppercase tracking-widest mr-1">
                {isNegative ? 'Why pass?' : 'Why interesting?'}
              </span>
              {suggestedTags.map(tag => {
                const active = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => handleTag(tag)}
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-all duration-150 ${
                      active
                        ? isNegative
                          ? 'bg-red-950/60 border-red-800 text-red-400'
                          : 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold'
                        : 'border-terrain-border text-terrain-muted hover:border-terrain-subtle hover:text-terrain-text'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>

            {/* Note toggle + textarea */}
            <div>
              {!showNote ? (
                <button
                  onClick={() => setShowNote(true)}
                  className="text-[10px] font-mono text-terrain-muted hover:text-terrain-gold transition-colors"
                >
                  + Add note
                </button>
              ) : (
                <textarea
                  value={note}
                  onChange={e => handleNote(e.target.value)}
                  onBlur={() => { if (!note) setShowNote(false) }}
                  placeholder="Optional note…"
                  rows={2}
                  className="w-full bg-terrain-bg border border-terrain-border rounded px-3 py-2 text-xs font-mono text-terrain-text placeholder-terrain-muted/50 focus:outline-none focus:border-terrain-subtle resize-none"
                  autoFocus
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
