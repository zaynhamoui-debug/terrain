import { useState, useRef } from 'react'
import { STAGE_STYLES } from './CompanyCard'
import { formatRaised, saveStructuredNotes, type PickCompany, type PickFeedbackLabel, type StructuredNotes } from '../lib/prospectingPicks'
import type { ProspectScore } from '../lib/prospecting/scoring'

interface Props {
  pick:       PickCompany
  feedback?:  PickFeedbackLabel
  userId?:    string
  onFeedback: (label: PickFeedbackLabel) => void
  onSelect?:  () => void
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
    <div className="flex flex-col items-center rounded bg-terrain-bg border border-terrain-border px-2.5 py-1.5 min-w-[44px]">
      <span className={`text-base font-bold font-mono leading-tight ${color}`}>{value}</span>
      <span className="text-[9px] font-mono text-terrain-muted uppercase tracking-widest">{label}</span>
    </div>
  )
}

function MuckerLens({ score }: { score: ProspectScore }) {
  return (
    <div className="rounded bg-terrain-bg border border-terrain-goldBorder overflow-hidden">
      <p className="text-[9px] font-mono uppercase tracking-widest text-terrain-gold px-3 pt-2.5 pb-1">Mucker Lens</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 pb-3">
        <div>
          <p className="text-[9px] font-mono text-terrain-gold/60 uppercase tracking-widest mb-1">Why Mucker</p>
          <ul className="flex flex-col gap-0.5">
            {score.muckerLens.whyMucker.map((w, i) => (
              <li key={i} className="text-xs font-mono text-terrain-text/80 leading-relaxed">✓ {w}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] font-mono text-red-400/60 uppercase tracking-widest mb-1">Risks</p>
          <ul className="flex flex-col gap-0.5">
            {score.muckerLens.mainRisks.map((r, i) => (
              <li key={i} className="text-xs font-mono text-terrain-muted/80 leading-relaxed">– {r}</li>
            ))}
          </ul>
        </div>
      </div>
      {score.muckerLens.suggestedNextStep && (
        <div className="border-t border-terrain-goldBorder/30 px-3 py-2 bg-terrain-bg/20">
          <span className="text-[9px] font-mono text-terrain-gold/60 uppercase tracking-widest">Next Step · </span>
          <span className="text-xs font-mono text-terrain-text/80">{score.muckerLens.suggestedNextStep}</span>
        </div>
      )}
    </div>
  )
}

const NOTE_FIELDS: Array<{ key: keyof StructuredNotes; label: string; placeholder: string }> = [
  { key: 'market_note',         label: 'Market Opportunity',  placeholder: 'Market size, TAM, timing…' },
  { key: 'team_note',           label: 'Team / Founder',      placeholder: 'Background, domain expertise…' },
  { key: 'traction_note',       label: 'Traction Signals',    placeholder: 'Growth, revenue, customers…' },
  { key: 'business_model_note', label: 'Business Model',      placeholder: 'Revenue model, margins, GTM…' },
  { key: 'under_radar_note',    label: 'Under-Radar Edge',    placeholder: 'Why this is quiet / non-obvious…' },
  { key: 'risks_note',          label: 'Risks',               placeholder: 'Key concerns…' },
]

function StructuredNoteForm({ pickId, userId }: { pickId: string; userId: string }) {
  const [notes,   setNotes]   = useState<StructuredNotes>({})
  const [saved,   setSaved]   = useState(false)
  const [open,    setOpen]    = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(key: keyof StructuredNotes, value: string) {
    setNotes(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await saveStructuredNotes(userId, pickId, notes)
      setSaved(true)
    }, 300)
  }

  return (
    <div className="border-t border-terrain-border pt-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[10px] font-mono text-terrain-muted hover:text-terrain-gold transition-colors"
      >
        {open ? '▲ Hide review notes' : '▼ Add review notes'}
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {NOTE_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-[9px] font-mono text-terrain-muted uppercase tracking-widest mb-0.5">
                {label}
              </label>
              <input
                type="text"
                value={notes[key] ?? ''}
                onChange={e => handleChange(key, e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder}
                className="w-full bg-terrain-bg border border-terrain-border rounded px-2.5 py-1.5 text-xs font-mono text-terrain-text placeholder-terrain-muted/40 focus:outline-none focus:border-terrain-goldBorder transition-colors"
              />
            </div>
          ))}
          {saved && (
            <p className="text-[9px] font-mono text-emerald-400">✓ Notes saved</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PickCard({ pick, feedback, userId, onFeedback, onSelect }: Props) {
  const [showLens, setShowLens] = useState(false)

  const stageClass = STAGE_STYLES[pick.stage ?? ''] ?? 'bg-slate-900 text-slate-400 border-slate-700'
  const recBadge   = REC_BADGE[pick.score.recommendation] ?? REC_BADGE.watch
  const raised     = formatRaised(pick.totalRaisedUsd)

  const websiteHost = (() => {
    if (!pick.website) return null
    try { return new URL(pick.website).hostname.replace('www.', '') }
    catch { return pick.website }
  })()

  const borderCls = feedback === 'intro_requested' ? 'border-terrain-goldBorder/70'
    : feedback === 'like'            ? 'border-emerald-800/60'
    : feedback === 'not_relevant' || feedback === 'too_late' ? 'border-red-900/60 opacity-80'
    : 'border-terrain-border hover:border-terrain-subtle'

  return (
    <div className={`bg-terrain-surface border rounded-lg p-5 flex flex-col gap-4 transition-all duration-200 ${borderCls}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-terrain-muted text-[10px] font-mono shrink-0">#{pick.rank}</span>
            <button
              onClick={onSelect}
              className={`font-display text-base font-bold text-terrain-text ${onSelect ? 'hover:text-terrain-gold transition-colors cursor-pointer' : ''}`}
            >
              {pick.name}
            </button>
            {pick.stage && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${stageClass}`}>
                {pick.stage}
              </span>
            )}
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${recBadge.cls}`}>
              {recBadge.label}
            </span>
          </div>
          {pick.description && (
            <p className="text-terrain-muted text-xs font-mono leading-relaxed line-clamp-2">{pick.description}</p>
          )}
        </div>

        {/* Score pills */}
        <div className="flex gap-1.5 flex-shrink-0">
          <ScorePill label="MQS" value={pick.score.mqs} />
          <ScorePill label="MUS" value={pick.score.mus} />
          <ScorePill label="Fit" value={pick.score.combinedScore} />
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono text-terrain-muted">
        {pick.sector && (
          <span className="px-2 py-0.5 rounded bg-terrain-bg border border-terrain-border">{pick.sector}</span>
        )}
        {pick.location   && <span>📍 {pick.location}</span>}
        {pick.foundedYear && <span>Est. {pick.foundedYear}</span>}
        {pick.employeeCount && <span>👥 {pick.employeeCount} employees</span>}
        {raised && <span className="text-terrain-gold font-bold">{raised} raised</span>}
        {pick.investors.length > 0 && (
          <span className="text-terrain-muted/60">{pick.investors.slice(0, 2).join(', ')}</span>
        )}
      </div>

      {/* Rationale (Haiku-generated why_mucker) */}
      {pick.rationale && (
        <div className="rounded bg-terrain-bg border border-terrain-goldBorder px-3 py-2.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-terrain-gold mb-1">Why Mucker</p>
          <p className="text-xs font-mono text-terrain-text/80 leading-relaxed">{pick.rationale}</p>
        </div>
      )}

      {/* Mucker Lens (collapsible) */}
      <button
        onClick={() => setShowLens(v => !v)}
        className="text-[10px] font-mono text-terrain-muted hover:text-terrain-gold transition-colors text-left"
      >
        {showLens ? '▲ Hide scoring breakdown' : '▼ Show scoring breakdown'}
      </button>
      {showLens && <MuckerLens score={pick.score} />}

      {/* Links */}
      {websiteHost && (
        <div className="flex items-center gap-3 border-t border-terrain-border pt-3">
          <a
            href={pick.website!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-mono text-terrain-muted hover:text-terrain-gold transition-colors"
          >
            <span className="text-terrain-gold">↗</span>
            {websiteHost}
          </a>
        </div>
      )}

      {/* Feedback buttons */}
      <div className="border-t border-terrain-border pt-3 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-mono text-terrain-muted uppercase tracking-widest mr-1">Action</span>
        {FEEDBACK_BUTTONS.map(btn => (
          <button
            key={btn.label}
            onClick={() => onFeedback(btn.label)}
            className={`px-2.5 py-1 rounded border text-[11px] font-mono transition-all duration-150 ${
              feedback === btn.label
                ? btn.active
                : `border-terrain-border text-terrain-muted ${btn.hover}`
            }`}
          >
            {btn.display}
          </button>
        ))}
      </div>

      {/* Structured review notes — only shown after a label is chosen */}
      {feedback && userId && (
        <StructuredNoteForm pickId={pick.pickId} userId={userId} />
      )}
    </div>
  )
}
