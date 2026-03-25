import { useState, useEffect, useCallback } from 'react'
import { Company } from '../types/marketMap'
import { supabase } from '../lib/supabase'
import { copyToClipboard } from '../lib/export'

interface Props {
  company: Company
  mapId: string | null
  onClose: () => void
  isWatchlisted?: boolean
  onToggleWatchlist?: (company: Company) => void
}

function Pill({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <span
      className={`text-xs px-3 py-1 rounded border font-mono ${
        gold
          ? 'border-terrain-goldBorder bg-terrain-goldDim text-terrain-gold'
          : 'border-terrain-border bg-terrain-bg text-terrain-muted'
      }`}
    >
      {label}
    </span>
  )
}

function StatBlock({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div>
      <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-1">{label}</div>
      <div className={`text-sm font-semibold font-mono ${gold ? 'text-terrain-gold' : 'text-terrain-text'}`}>
        {value || '—'}
      </div>
    </div>
  )
}

const STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Public']

function FundingLadder({ stage }: { stage: string }) {
  if (stage === 'Acquired' || stage === 'Bootstrapped') return null

  const currentIdx = STAGES.indexOf(stage)
  if (currentIdx === -1) return null

  return (
    <div>
      <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-3">
        Funding Stage
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {STAGES.map((s, i) => {
          const isCurrent = i === currentIdx
          const isPast    = i < currentIdx
          return (
            <div key={s} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    isCurrent
                      ? 'bg-terrain-gold ring-2 ring-terrain-gold/30'
                      : isPast
                        ? 'bg-emerald-700'
                        : 'bg-terrain-border'
                  }`}
                />
                <span
                  className={`text-[9px] font-mono whitespace-nowrap ${
                    isCurrent
                      ? 'text-terrain-gold font-bold'
                      : isPast
                        ? 'text-emerald-600'
                        : 'text-terrain-border'
                  }`}
                >
                  {s}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`h-px w-4 mb-3 ${
                    i < currentIdx ? 'bg-emerald-700' : 'bg-terrain-border'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CompanyModal({ company, mapId, onClose, isWatchlisted, onToggleWatchlist }: Props) {
  const [note,       setNote]       = useState('')
  const [isSaving,   setIsSaving]   = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [copiedJSON, setCopiedJSON] = useState(false)

  // Load note from Supabase
  useEffect(() => {
    async function load() {
      if (!mapId) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('map_notes')
        .select('note')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .eq('map_id', mapId)
        .maybeSingle()
      if (data) setNote(data.note ?? '')
    }
    load()
  }, [company.id, mapId])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const saveNote = useCallback(async () => {
    if (!mapId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setIsSaving(true)
    await supabase.from('map_notes').upsert(
      { user_id: user.id, company_id: company.id, map_id: mapId, note, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,company_id,map_id' }
    )
    setIsSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [company.id, mapId, note])

  async function handleCopyJSON() {
    await copyToClipboard(JSON.stringify(company, null, 2))
    setCopiedJSON(true)
    setTimeout(() => setCopiedJSON(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-terrain-surface border border-terrain-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div
          className="px-7 pt-7 pb-5 border-b border-terrain-border"
          style={company.is_focal_company ? { borderTopColor: '#c9a84c', borderTopWidth: 2 } : {}}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-display text-2xl font-bold text-terrain-text">{company.name}</h2>
                {company.is_focal_company && (
                  <span className="text-[10px] border border-terrain-gold text-terrain-gold px-2 py-0.5 rounded font-mono tracking-widest">
                    FOCAL
                  </span>
                )}
              </div>
              <p className="text-terrain-muted text-sm font-mono mt-1.5 leading-relaxed">{company.tagline}</p>
              <div className="flex items-center gap-4 mt-1">
                {company.website && (
                  <a
                    href={`https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-terrain-gold text-xs font-mono hover:underline inline-block"
                  >
                    {company.website} ↗
                  </a>
                )}
                {company.linkedin && (
                  <a
                    href={`https://linkedin.com/${company.linkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-terrain-muted text-xs font-mono hover:text-terrain-gold hover:underline inline-block transition-colors"
                  >
                    LinkedIn ↗
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {/* Watchlist toggle */}
              {onToggleWatchlist && (
                <button
                  onClick={() => onToggleWatchlist(company)}
                  className={`text-xl leading-none transition-colors ${
                    isWatchlisted ? 'text-terrain-gold' : 'text-terrain-muted hover:text-terrain-gold'
                  }`}
                  title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {isWatchlisted ? '♥' : '♡'}
                </button>
              )}
              {/* Copy JSON */}
              <button
                onClick={handleCopyJSON}
                className="text-terrain-muted hover:text-terrain-text text-xs font-mono border border-terrain-border px-2 py-1 rounded transition-colors"
                title="Copy company data as JSON"
              >
                {copiedJSON ? 'Copied!' : 'Copy JSON'}
              </button>
              {/* Close */}
              <button
                onClick={onClose}
                className="text-terrain-muted hover:text-terrain-text text-2xl leading-none transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div className="px-7 py-6 space-y-7">

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            <StatBlock label="Stage"      value={company.stage} />
            <StatBlock label="Funding"    value={company.funding_display}   gold />
            <StatBlock label="Valuation"  value={company.valuation_display} gold />
            <StatBlock label="Founded"    value={company.founded?.toString()} />
            <StatBlock label="Headcount"  value={company.headcount_range} />
            <StatBlock label="HQ"         value={company.hq} />
          </div>

          {/* Funding stage ladder */}
          <FundingLadder stage={company.stage} />

          {/* Last round + momentum */}
          <div className="flex flex-wrap gap-5">
            {company.last_round && <StatBlock label="Last Round"     value={company.last_round} />}
            {company.momentum_signal && <StatBlock label="Momentum" value={company.momentum_signal} />}
          </div>

          {/* Differentiator */}
          <div>
            <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-2">
              Moat / Differentiator
            </div>
            <p className="text-terrain-text text-sm font-mono leading-relaxed border-l-2 border-terrain-gold pl-4">
              {company.differentiator}
            </p>
          </div>

          {/* Investors */}
          {company.investors?.length > 0 && (
            <div>
              <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-3">
                Investors
              </div>
              <div className="flex flex-wrap gap-2">
                {company.investors.map(inv => <Pill key={inv} label={inv} />)}
              </div>
            </div>
          )}

          {/* Key customers */}
          {company.key_customers?.length > 0 && (
            <div>
              <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-3">
                Key Customers
              </div>
              <div className="flex flex-wrap gap-2">
                {company.key_customers.map(c => <Pill key={c} label={c} gold />)}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">
                Your Notes
              </div>
              {isSaving && <span className="text-terrain-muted text-[10px] font-mono">saving…</span>}
              {saved    && <span className="text-terrain-gold  text-[10px] font-mono">saved ✓</span>}
              {!mapId   && <span className="text-terrain-muted text-[10px] font-mono">(map not yet saved)</span>}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              onBlur={saveNote}
              disabled={!mapId}
              placeholder={mapId ? 'Add private notes about this company…' : 'Generate and save a map first'}
              rows={4}
              className="w-full bg-terrain-bg border border-terrain-border rounded px-4 py-3 text-terrain-text text-sm font-mono resize-none focus:outline-none focus:border-terrain-gold transition-colors placeholder-terrain-muted disabled:opacity-40"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
