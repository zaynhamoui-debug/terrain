import { useEffect } from 'react'
import type { ProspectScore } from '../lib/prospecting/scoring'
import { formatRaised, type PickCompany, type PickFeedbackLabel } from '../lib/prospectingPicks'

interface Props {
  pick:       PickCompany | null
  feedback?:  PickFeedbackLabel
  onClose:    () => void
  onFeedback: (label: PickFeedbackLabel) => void
}

const REC_BADGE: Record<string, { label: string; cls: string }> = {
  strong_pick: { label: 'Strong Pick', cls: 'bg-emerald-950 border-emerald-700 text-emerald-400' },
  pick:        { label: 'Pick',        cls: 'bg-blue-950   border-blue-700   text-blue-400'   },
  watch:       { label: 'Watch',       cls: 'bg-slate-800  border-slate-600  text-slate-400'  },
  pass:        { label: 'Low Signal',  cls: 'bg-red-950    border-red-900    text-red-500'    },
}

const FEEDBACK_BUTTONS: Array<{ label: PickFeedbackLabel; display: string; active: string; hover: string }> = [
  { label: 'intro_requested', display: '⊕ Request Intro', active: 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold', hover: 'hover:border-terrain-goldBorder hover:text-terrain-gold' },
  { label: 'like',            display: '↑ Good Fit',      active: 'bg-emerald-950 border-emerald-700 text-emerald-400',            hover: 'hover:border-emerald-700 hover:text-emerald-400' },
  { label: 'not_relevant',    display: '↓ Not a Fit',     active: 'bg-red-950 border-red-800 text-red-400',                        hover: 'hover:border-red-800 hover:text-red-400' },
  { label: 'already_known',   display: '✓ Known',         active: 'bg-slate-800 border-slate-600 text-slate-300',                  hover: 'hover:border-slate-600 hover:text-slate-300' },
  { label: 'too_late',        display: '⊘ Too Late',      active: 'bg-orange-950 border-orange-700 text-orange-400',               hover: 'hover:border-orange-700 hover:text-orange-400' },
]

function ScorePill({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'text-emerald-400' : value >= 50 ? 'text-terrain-gold' : 'text-red-400'
  return (
    <div className="flex flex-col items-center rounded bg-terrain-bg border border-terrain-border px-4 py-2 min-w-[56px]">
      <span className={`text-xl font-bold font-mono leading-tight ${color}`}>{value}</span>
      <span className="text-[9px] font-mono text-terrain-muted uppercase tracking-widest mt-0.5">{label}</span>
    </div>
  )
}

function LensSection({ score }: { score: ProspectScore }) {
  return (
    <div className="rounded bg-terrain-bg border border-terrain-goldBorder overflow-hidden">
      <p className="text-[9px] font-mono uppercase tracking-widest text-terrain-gold px-4 pt-3 pb-1.5">Mucker Lens</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 pb-3">
        <div>
          <p className="text-[9px] font-mono text-terrain-gold/60 uppercase tracking-widest mb-1.5">Why Mucker</p>
          <ul className="flex flex-col gap-1">
            {score.muckerLens.whyMucker.map((w, i) => (
              <li key={i} className="text-xs font-mono text-terrain-text/80 leading-relaxed">✓ {w}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] font-mono text-red-400/60 uppercase tracking-widest mb-1.5">Risks</p>
          <ul className="flex flex-col gap-1">
            {score.muckerLens.mainRisks.map((r, i) => (
              <li key={i} className="text-xs font-mono text-terrain-muted/80 leading-relaxed">– {r}</li>
            ))}
          </ul>
        </div>
      </div>
      {score.muckerLens.suggestedNextStep && (
        <div className="border-t border-terrain-goldBorder/30 px-4 py-2.5">
          <span className="text-[9px] font-mono text-terrain-gold/60 uppercase tracking-widest">Next Step · </span>
          <span className="text-xs font-mono text-terrain-text/80">{score.muckerLens.suggestedNextStep}</span>
        </div>
      )}
    </div>
  )
}

export default function CompanyDrawer({ pick, feedback, onClose, onFeedback }: Props) {
  useEffect(() => {
    if (!pick) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pick, onClose])

  if (!pick) return null

  const recBadge  = REC_BADGE[pick.score.recommendation] ?? REC_BADGE.watch
  const raised    = formatRaised(pick.totalRaisedUsd)
  const websiteHost = (() => {
    if (!pick.website) return null
    try { return new URL(pick.website).hostname.replace('www.', '') }
    catch { return pick.website }
  })()

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-terrain-bg border-l border-terrain-border flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-terrain-border bg-terrain-surface">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {pick.rank && (
                <span className="text-terrain-muted text-[10px] font-mono shrink-0">#{pick.rank}</span>
              )}
              <h2 className="font-display text-lg font-bold text-terrain-text leading-tight">{pick.name}</h2>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${recBadge.cls}`}>
                {recBadge.label}
              </span>
            </div>
            {websiteHost && (
              <a
                href={pick.website!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-terrain-gold hover:text-terrain-text transition-colors"
              >
                ↗ {websiteHost}
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-terrain-muted hover:text-terrain-text text-sm font-mono mt-0.5 shrink-0 transition-colors"
          >
            ✕ close
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Scores */}
          <div className="flex gap-2">
            <ScorePill label="MQS" value={pick.score.mqs} />
            <ScorePill label="MUS" value={pick.score.mus} />
            <ScorePill label="Fit" value={pick.score.combinedScore} />
          </div>

          {/* Description */}
          {pick.description && (
            <p className="text-sm font-mono text-terrain-text/85 leading-relaxed">{pick.description}</p>
          )}

          {/* Key facts grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Sector',    value: pick.sector },
              { label: 'Stage',     value: pick.stage },
              { label: 'Location',  value: pick.location },
              { label: 'Founded',   value: pick.foundedYear },
              { label: 'Employees', value: pick.employeeCount },
              { label: 'Raised',    value: raised, gold: true },
            ].map(({ label, value, gold }) => value ? (
              <div key={label}>
                <p className="text-[9px] font-mono text-terrain-muted uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-xs font-mono ${gold ? 'text-terrain-gold font-bold' : 'text-terrain-text'}`}>
                  {String(value)}
                </p>
              </div>
            ) : null)}
          </div>

          {/* Investors */}
          {pick.investors.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-terrain-muted uppercase tracking-widest mb-2">Investors</p>
              <div className="flex flex-wrap gap-1.5">
                {pick.investors.map(inv => (
                  <span key={inv} className="px-2 py-0.5 rounded bg-terrain-surface border border-terrain-border text-xs font-mono text-terrain-text">
                    {inv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rationale */}
          {pick.rationale && (
            <div className="rounded bg-terrain-surface border border-terrain-goldBorder px-4 py-3">
              <p className="text-[9px] font-mono text-terrain-gold uppercase tracking-widest mb-1.5">Why Mucker</p>
              <p className="text-xs font-mono text-terrain-text/85 leading-relaxed">{pick.rationale}</p>
            </div>
          )}

          {/* Mucker Lens */}
          <LensSection score={pick.score} />

        </div>

        {/* Footer — feedback */}
        <div className="border-t border-terrain-border px-6 py-4 bg-terrain-surface">
          <p className="text-[9px] font-mono text-terrain-muted uppercase tracking-widest mb-2.5">Action</p>
          <div className="flex gap-1.5 flex-wrap">
            {FEEDBACK_BUTTONS.map(btn => (
              <button
                key={btn.label}
                onClick={() => onFeedback(btn.label)}
                className={`px-2.5 py-1.5 rounded border text-[11px] font-mono transition-all duration-150 ${
                  feedback === btn.label
                    ? btn.active
                    : `border-terrain-border text-terrain-muted ${btn.hover}`
                }`}
              >
                {btn.display}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
