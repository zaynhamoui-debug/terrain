import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Company } from '../types/marketMap'
import { supabase } from '../lib/supabase'
import { copyToClipboard } from '../lib/export'
import { generateInvestmentMemo, detectRedFlags } from '../lib/chatApi'
import { scoreToColor } from './CompanyCard'

interface Props {
  company: Company
  mapId: string | null
  onClose: () => void
  isWatchlisted?: boolean
  onToggleWatchlist?: (company: Company) => void
  dealStatus?: string
  onSetDealStatus?: (companyId: string, companyName: string, status: string | null) => void
  sector?: string
  score?: number
  trackingStatus?: 'viewed' | 'targeted'
  onToggleTracking?: (company: Company, status: 'viewed' | 'targeted') => void
}

const DEAL_STATUS_OPTIONS = [
  { value: '',             label: 'None' },
  { value: 'watching',     label: 'Watching' },
  { value: 'outreach',     label: 'Outreach' },
  { value: 'meeting',      label: 'Meeting' },
  { value: 'due_diligence',label: 'Due Diligence' },
  { value: 'portfolio',    label: 'Portfolio' },
  { value: 'passed',       label: 'Passed' },
]

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
      <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-3">Funding Stage</div>
      <div className="flex items-center gap-1 flex-wrap">
        {STAGES.map((s, i) => {
          const isCurrent = i === currentIdx
          const isPast    = i < currentIdx
          return (
            <div key={s} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isCurrent ? 'bg-terrain-gold ring-2 ring-terrain-gold/30' : isPast ? 'bg-emerald-700' : 'bg-terrain-border'}`} />
                <span className={`text-[9px] font-mono whitespace-nowrap ${isCurrent ? 'text-terrain-gold font-bold' : isPast ? 'text-emerald-600' : 'text-terrain-border'}`}>{s}</span>
              </div>
              {i < STAGES.length - 1 && <div className={`h-px w-4 mb-3 ${i < currentIdx ? 'bg-emerald-700' : 'bg-terrain-border'}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Headcount Growth Chart ───────────────────────────────────────────────────

function parseHeadcount(range: string): number {
  if (!range) return 10
  const m = range.match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)/)
  if (m) return Math.round((parseInt(m[1].replace(/,/g, '')) + parseInt(m[2].replace(/,/g, ''))) / 2)
  // Handle formats like "51-200 employees" or "1,001-5,000"
  const m2 = range.match(/(\d[\d,]+)/)
  if (m2) return parseInt(m2[1].replace(/,/g, ''))
  return 10
}

function buildGrowthData(company: Company) {
  const current = parseHeadcount(company.headcount_range)
  // Estimate founding year from stage if missing
  const stageYearGuess: Record<string, number> = {
    'Pre-Seed': 2023, 'Seed': 2021, 'Series A': 2019,
    'Series B': 2017, 'Series C': 2015, 'Series D+': 2013,
    'Public': 2010, 'Acquired': 2015, 'Bootstrapped': 2018,
  }
  const founded = (company.founded && company.founded > 1990)
    ? company.founded
    : (stageYearGuess[company.stage] ?? 2020)
  const now = 2025
  const years = Math.max(1, now - founded)
  return Array.from({ length: years + 1 }, (_, i) => {
    const t = i / years
    const employees = Math.max(1, Math.round(3 * Math.pow(Math.max(current, 4) / 3, t)))
    return { year: founded + i, employees }
  })
}

function HeadcountChart({ company }: { company: Company }) {
  const data = buildGrowthData(company)
  const current = parseHeadcount(company.headcount_range)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">
          Employee Growth (Estimated)
        </span>
        <span className="text-terrain-gold text-xs font-mono font-bold">{current} employees</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,237,232,0.06)" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#8a8070', fontSize: 9, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(240,237,232,0.1)' }}
          />
          <YAxis
            tick={{ fill: '#8a8070', fontSize: 9, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1810',
              border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#f0ede8',
            }}
            formatter={(v) => [`${v} employees`, 'Headcount']}
            labelStyle={{ color: '#8a8070' }}
          />
          <Line
            type="monotone"
            dataKey="employees"
            stroke="#c9a84c"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#c9a84c', stroke: '#1a1810' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-terrain-muted text-[9px] font-mono mt-1 text-center opacity-60">
        Estimated based on founding year & current headcount
      </p>
    </div>
  )
}

// ─── Score Display ────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = scoreToColor(score)
  const hue = Math.round(((score - 1) / 9) * 120)
  const label =
    score >= 9 ? 'Exceptional' :
    score >= 7 ? 'Strong' :
    score >= 5 ? 'Moderate' :
    score >= 3 ? 'Weak' : 'Poor'

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: `hsl(${hue}, 50%, 25%)`, background: `hsl(${hue}, 50%, 6%)` }}>
      <div className="text-3xl font-bold font-display" style={{ color }}>{score}</div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color }}>
          Investment Score · {label}
        </div>
        <div className="text-terrain-muted text-[9px] font-mono mt-0.5">
          AI-assessed on momentum, differentiation & stage fit
        </div>
      </div>
      <div className="ml-auto flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="w-1.5 h-4 rounded-sm"
            style={{
              background: i < score
                ? `hsl(${Math.round((i / 9) * 120)}, 65%, 45%)`
                : 'rgba(240,237,232,0.06)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function CompanyModal({
  company, mapId, onClose, isWatchlisted, onToggleWatchlist,
  dealStatus, onSetDealStatus, sector, score, trackingStatus, onToggleTracking,
}: Props) {
  const [note,         setNote]         = useState('')
  const [isSaving,     setIsSaving]     = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [copiedJSON,   setCopiedJSON]   = useState(false)

  const [memo,         setMemo]         = useState('')
  const [memoLoading,  setMemoLoading]  = useState(false)
  const [memoError,    setMemoError]    = useState<string | null>(null)
  const [memoExpanded, setMemoExpanded] = useState(true)

  const [redFlags,        setRedFlags]        = useState('')
  const [redFlagsLoading, setRedFlagsLoading] = useState(false)
  const [redFlagsError,   setRedFlagsError]   = useState<string | null>(null)

  const [localDealStatus, setLocalDealStatus] = useState(dealStatus ?? '')
  const [dealSaving,      setDealSaving]      = useState(false)

  const [trackingSaving, setTrackingSaving] = useState(false)

  useEffect(() => { setLocalDealStatus(dealStatus ?? '') }, [dealStatus])

  useEffect(() => {
    async function load() {
      if (!mapId) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('map_notes').select('note')
        .eq('user_id', user.id).eq('company_id', company.id).eq('map_id', mapId)
        .maybeSingle()
      if (data) setNote(data.note ?? '')
    }
    load()
  }, [company.id, mapId])

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

  async function handleGenerateMemo() {
    setMemoLoading(true); setMemoError(null); setMemo('')
    try { setMemo(await generateInvestmentMemo(company, sector ?? 'Unknown')); setMemoExpanded(true) }
    catch (err) { setMemoError(err instanceof Error ? err.message : 'Failed') }
    finally { setMemoLoading(false) }
  }

  async function handleDetectRedFlags() {
    setRedFlagsLoading(true); setRedFlagsError(null); setRedFlags('')
    try { setRedFlags(await detectRedFlags(company, sector ?? 'Unknown')) }
    catch (err) { setRedFlagsError(err instanceof Error ? err.message : 'Failed') }
    finally { setRedFlagsLoading(false) }
  }

  async function handleDealStatusChange(newStatus: string) {
    setLocalDealStatus(newStatus); setDealSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (!newStatus) {
        await supabase.from('deal_flow').delete().eq('user_id', user.id).eq('company_id', company.id)
        onSetDealStatus?.(company.id, company.name, null)
      } else {
        await supabase.from('deal_flow').upsert(
          { user_id: user.id, company_id: company.id, company_name: company.name, company_data: company, status: newStatus, map_id: mapId ?? undefined, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,company_id' }
        )
        onSetDealStatus?.(company.id, company.name, newStatus)
      }
    } finally { setDealSaving(false) }
  }

  async function handleTracking(status: 'viewed' | 'targeted') {
    if (!onToggleTracking) return
    setTrackingSaving(true)
    try { onToggleTracking(company, status) }
    finally { setTimeout(() => setTrackingSaving(false), 400) }
  }

  // Funding efficiency: $ per employee
  const headcountNum = parseHeadcount(company.headcount_range)
  const fundingMatch = company.funding_display?.match(/\$([\d.]+)([MBK]?)/)
  let fundingPerEmp = ''
  if (fundingMatch && headcountNum > 0) {
    const mul = fundingMatch[2] === 'B' ? 1e9 : fundingMatch[2] === 'M' ? 1e6 : 1e3
    const totalFunding = parseFloat(fundingMatch[1]) * mul
    const perEmp = totalFunding / headcountNum
    fundingPerEmp = perEmp >= 1e6 ? `$${(perEmp / 1e6).toFixed(1)}M` : perEmp >= 1e3 ? `$${Math.round(perEmp / 1000)}K` : `$${Math.round(perEmp)}`
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
                  <span className="text-[10px] border border-terrain-gold text-terrain-gold px-2 py-0.5 rounded font-mono tracking-widest">FOCAL</span>
                )}
                {trackingStatus === 'targeted' && (
                  <span className="text-[10px] border border-terrain-goldBorder bg-terrain-goldDim text-terrain-gold px-2 py-0.5 rounded font-mono">⊙ TARGETED</span>
                )}
                {trackingStatus === 'viewed' && (
                  <span className="text-[10px] border border-terrain-border text-terrain-muted px-2 py-0.5 rounded font-mono">✓ VIEWED</span>
                )}
              </div>
              <p className="text-terrain-muted text-sm font-mono mt-1.5 leading-relaxed">{company.tagline}</p>
              <div className="flex items-center gap-4 mt-1">
                {company.website && (
                  <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-terrain-gold text-xs font-mono hover:underline inline-block">
                    {company.website} ↗
                  </a>
                )}
                {company.linkedin && (
                  <a href={`https://linkedin.com/${company.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-terrain-muted text-xs font-mono hover:text-terrain-gold hover:underline inline-block transition-colors">
                    LinkedIn ↗
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {onToggleWatchlist && (
                <button
                  onClick={() => onToggleWatchlist(company)}
                  className={`text-xl leading-none transition-colors ${isWatchlisted ? 'text-terrain-gold' : 'text-terrain-muted hover:text-terrain-gold'}`}
                  title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {isWatchlisted ? '♥' : '♡'}
                </button>
              )}
              <button onClick={handleCopyJSON} className="text-terrain-muted hover:text-terrain-text text-xs font-mono border border-terrain-border px-2 py-1 rounded transition-colors" title="Copy company data as JSON">
                {copiedJSON ? 'Copied!' : 'Copy JSON'}
              </button>
              <button onClick={onClose} className="text-terrain-muted hover:text-terrain-text text-2xl leading-none transition-colors">×</button>
            </div>
          </div>
        </div>

        <div className="px-7 py-6 space-y-7">

          {/* AI Investment Score */}
          {score !== undefined && score !== null && (
            <ScoreBadge score={score} />
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-terrain-border border border-terrain-border rounded-lg overflow-hidden">
            {[
              { label: 'Stage',     value: company.stage,               gold: false },
              { label: 'Funding',   value: company.funding_display,     gold: true  },
              { label: 'Valuation', value: company.valuation_display,   gold: true  },
              { label: 'Founded',   value: company.founded?.toString(), gold: false },
              { label: 'Headcount', value: company.headcount_range,     gold: false },
              { label: 'HQ',        value: company.hq,                  gold: false },
            ].map((stat, i) => (
              <div key={stat.label} className={`px-4 py-3 bg-terrain-bg ${i >= 3 ? 'border-t border-terrain-border' : ''}`}>
                <StatBlock label={stat.label} value={stat.value} gold={stat.gold} />
              </div>
            ))}
          </div>

          {/* Funding efficiency */}
          {fundingPerEmp && (
            <div className="flex flex-wrap gap-5">
              {company.last_round && <StatBlock label="Last Round" value={company.last_round} />}
              {company.momentum_signal && <StatBlock label="Momentum" value={company.momentum_signal} />}
              <StatBlock label="$ per Employee" value={fundingPerEmp} />
            </div>
          )}
          {!fundingPerEmp && (
            <div className="flex flex-wrap gap-5">
              {company.last_round && <StatBlock label="Last Round" value={company.last_round} />}
              {company.momentum_signal && <StatBlock label="Momentum" value={company.momentum_signal} />}
            </div>
          )}

          {/* Headcount Growth Chart */}
          {(company.headcount_range || company.headcount_range === '0') && (
            <div className="border border-terrain-border rounded-lg p-4 bg-terrain-bg">
              <HeadcountChart company={company} />
            </div>
          )}

          {/* Funding stage ladder */}
          <FundingLadder stage={company.stage} />

          {/* Differentiator */}
          <div>
            <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-2">Moat / Differentiator</div>
            <p className="text-terrain-text text-sm font-mono leading-relaxed border-l-2 border-terrain-gold pl-4">
              {company.differentiator}
            </p>
          </div>

          {/* Investors */}
          {company.investors?.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono shrink-0">Investors</span>
                <div className="flex-1 h-px bg-terrain-border" />
              </div>
              <div className="flex flex-wrap gap-2">{company.investors.map(inv => <Pill key={inv} label={inv} />)}</div>
            </div>
          )}

          {/* Key customers */}
          {company.key_customers?.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono shrink-0">Key Customers</span>
                <div className="flex-1 h-px bg-terrain-border" />
              </div>
              <div className="flex flex-wrap gap-2">{company.key_customers.map(c => <Pill key={c} label={c} gold />)}</div>
            </div>
          )}

          {/* Tracking */}
          {onToggleTracking && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono shrink-0">Tracking</span>
                <div className="flex-1 h-px bg-terrain-border" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleTracking('viewed')}
                  disabled={trackingSaving}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-mono border transition-all disabled:opacity-40 ${
                    trackingStatus === 'viewed'
                      ? 'bg-terrain-surface border-terrain-subtle text-terrain-text'
                      : 'border-terrain-border text-terrain-muted hover:text-terrain-text hover:border-terrain-subtle'
                  }`}
                >
                  ✓ {trackingStatus === 'viewed' ? 'Viewed' : 'Mark Viewed'}
                </button>
                <button
                  onClick={() => handleTracking('targeted')}
                  disabled={trackingSaving}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-mono border transition-all disabled:opacity-40 ${
                    trackingStatus === 'targeted'
                      ? 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold'
                      : 'border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder'
                  }`}
                >
                  ⊙ {trackingStatus === 'targeted' ? 'Targeted' : 'Mark Targeted'}
                </button>
              </div>
            </div>
          )}

          {/* Deal Flow */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono shrink-0">Deal Flow</span>
              <div className="flex-1 h-px bg-terrain-border" />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={localDealStatus}
                onChange={e => handleDealStatusChange(e.target.value)}
                disabled={dealSaving}
                className="bg-terrain-bg border border-terrain-border rounded px-3 py-2 text-terrain-text text-xs font-mono focus:outline-none focus:border-terrain-gold transition-colors disabled:opacity-40"
              >
                {DEAL_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              {dealSaving && <span className="text-terrain-muted text-[10px] font-mono">saving…</span>}
            </div>
          </div>

          {/* AI Actions */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono shrink-0">AI Analysis</span>
              <div className="flex-1 h-px bg-terrain-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleGenerateMemo}
                disabled={memoLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-terrain-goldDim border border-terrain-goldBorder text-terrain-gold text-xs font-mono rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {memoLoading ? (<><span className="w-3 h-3 border border-terrain-gold border-t-transparent rounded-full animate-spin" />Generating…</>) : 'Generate Memo'}
              </button>
              <button
                onClick={handleDetectRedFlags}
                disabled={redFlagsLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-950/40 border border-red-800/60 text-red-400 text-xs font-mono rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {redFlagsLoading ? (<><span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />Analyzing…</>) : '🚩 Red Flags'}
              </button>
            </div>

            {(memo || memoError) && (
              <div className="mt-4 border border-terrain-border rounded-lg overflow-hidden">
                <button onClick={() => setMemoExpanded(e => !e)} className="w-full flex items-center justify-between px-4 py-3 bg-terrain-bg text-left">
                  <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">Investment Memo</span>
                  <span className="text-terrain-muted text-xs">{memoExpanded ? '▾' : '▸'}</span>
                </button>
                {memoExpanded && (
                  <div className="px-4 pb-4 bg-terrain-bg">
                    {memoError ? <p className="text-red-400 text-xs font-mono">{memoError}</p> : <pre className="text-terrain-text text-xs font-mono leading-relaxed whitespace-pre-wrap">{memo}</pre>}
                  </div>
                )}
              </div>
            )}

            {(redFlags || redFlagsError) && (
              <div className="mt-3 px-4 py-3 border border-red-800/40 rounded-lg bg-red-950/20">
                <div className="text-red-400 text-[10px] uppercase tracking-widest font-mono mb-2">Red Flags</div>
                {redFlagsError ? <p className="text-red-400 text-xs font-mono">{redFlagsError}</p> : <pre className="text-terrain-text text-xs font-mono leading-relaxed whitespace-pre-wrap">{redFlags}</pre>}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono shrink-0">Your Notes</span>
              <div className="flex-1 h-px bg-terrain-border" />
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
