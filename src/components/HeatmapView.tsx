import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarketMap, Segment, Company } from '../types/marketMap'
import { searchAndEnrichSegment } from '../lib/claudeApi'
import { scoreToColor, STAGE_STYLES } from './CompanyCard'

const TARGET_STAGES = new Set(['Pre-Seed', 'Seed', 'Series A'])

const MOMENTUM_COLS = [
  { key: '🚀 Hypergrowth', emoji: '🚀', label: 'Hypergrowth', mucker: 'High conviction' },
  { key: '📈 Growing',     emoji: '📈', label: 'Growing',     mucker: 'Strong signal'   },
  { key: '➡️ Stable',     emoji: '➡️', label: 'Stable',      mucker: 'Monitor'         },
  { key: '⚠️ Challenged', emoji: '⚠️', label: 'Challenged',  mucker: 'Flag risk'       },
  { key: '🔒 Stealth',    emoji: '🔒', label: 'Stealth',      mucker: 'Needs diligence' },
] as const

const STAGE_BADGE: Record<string, string> = {
  'Pre-Seed': 'bg-slate-800 text-slate-300 border-slate-600',
  'Seed':     'bg-emerald-900 text-emerald-300 border-emerald-700',
  'Series A': 'bg-blue-900 text-blue-300 border-blue-700',
  'Series B': 'bg-violet-900 text-violet-300 border-violet-700',
  'Series C': 'bg-orange-900 text-orange-300 border-orange-700',
  'Series D+':'bg-red-900 text-red-300 border-red-700',
}

interface Props {
  map: MarketMap
  onCompanyClick: (company: Company) => void
  scoresMap?: Record<string, number>
}

function CompanyChip({ company, scoresMap, onClick }: {
  company: Company
  scoresMap?: Record<string, number>
  onClick: () => void
}) {
  const score = scoresMap?.[company.id]
  const hue = score ? Math.round(((score - 1) / 9) * 120) : null
  const isTargetStage = TARGET_STAGES.has(company.stage)
  const scoreStyle = (score && !company.is_focal_company) ? {
    borderColor: `hsl(${hue}, 55%, 28%)`,
    backgroundColor: `hsl(${hue}, 55%, 7%)`,
  } : {}
  const stageBadge = STAGE_BADGE[company.stage] ?? 'bg-slate-800 text-slate-400 border-slate-600'

  return (
    <button
      onClick={onClick}
      style={scoreStyle}
      className={`w-full text-left px-2 py-1.5 rounded text-[11px] font-mono leading-tight transition-all hover:scale-[1.01] hover:brightness-110 ${
        company.is_focal_company
          ? 'bg-terrain-goldDim border border-terrain-goldBorder text-terrain-gold'
          : `border ${!score ? 'bg-terrain-surface border-terrain-border' : ''} ${!isTargetStage ? 'opacity-60' : ''}`
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-terrain-text font-semibold leading-tight line-clamp-1 flex-1">{company.name}</span>
        {score && (
          <span className="shrink-0 text-[9px] font-bold tabular-nums" style={{ color: scoreToColor(score) }}>
            {score}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`text-[8px] px-1 py-0.5 rounded border font-mono ${stageBadge}`}>
          {company.stage}
        </span>
        {company.funding_display && company.funding_display !== '$0' && (
          <span className="text-terrain-muted text-[9px] font-mono">{company.funding_display}</span>
        )}
        {!isTargetStage && (
          <span className="text-[8px] text-red-400/60 font-mono">↑ stage</span>
        )}
      </div>
    </button>
  )
}

function SegmentStats({ seg, scoresMap }: { seg: Segment; scoresMap?: Record<string, number> }) {
  const all = seg.companies
  const scored = all.filter(c => scoresMap?.[c.id] !== undefined)
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, c) => s + (scoresMap![c.id] ?? 0), 0) / scored.length * 10) / 10
    : null
  const targetCount = all.filter(c => TARGET_STAGES.has(c.stage)).length
  const outOfScope = all.filter(c => !TARGET_STAGES.has(c.stage) && c.stage !== 'Bootstrapped').length
  const highConviction = scored.filter(c => (scoresMap![c.id] ?? 0) >= 8).length

  return (
    <div className="space-y-1.5 mt-2">
      {avgScore !== null && (
        <div className="flex items-center gap-1.5">
          <span className="text-terrain-muted text-[9px] font-mono uppercase tracking-wider">Avg</span>
          <span className="text-[11px] font-bold font-mono" style={{ color: scoreToColor(avgScore) }}>
            {avgScore}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-emerald-900/40 border-emerald-700/40 text-emerald-400">
          {targetCount} early-stage
        </span>
        {highConviction > 0 && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold">
            {highConviction} ≥8
          </span>
        )}
        {outOfScope > 0 && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-red-900/30 border-red-800/40 text-red-400/70">
            {outOfScope} B+
          </span>
        )}
      </div>
    </div>
  )
}

export default function HeatmapView({ map, onCompanyClick, scoresMap }: Props) {
  const navigate = useNavigate()
  const [segments, setSegments] = useState<Segment[]>(map.segments)
  const [loadingAll, setLoadingAll] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [allLoaded, setAllLoaded] = useState(false)

  async function loadAllCompanies() {
    setLoadingAll(true)
    const loadingSet = new Set(map.segments.map(s => s.id))
    setLoadingIds(loadingSet)

    const updated = await Promise.all(
      map.segments.map(async seg => {
        try {
          const companies = await searchAndEnrichSegment(map.sector, seg.name, seg.description)
          const existing = seg.companies
          const existingIds = new Set(existing.map(c => c.id))
          const newOnes = companies.filter(c => !existingIds.has(c.id))
          return { ...seg, companies: [...existing, ...newOnes] }
        } catch { return seg }
        finally { setLoadingIds(prev => { const n = new Set(prev); n.delete(seg.id); return n }) }
      })
    )

    setSegments(updated)
    setLoadingAll(false)
    setAllLoaded(true)
  }

  // Sector-level stats
  const allCompanies = segments.flatMap(s => s.companies)
  const totalEarlyStage = allCompanies.filter(c => TARGET_STAGES.has(c.stage)).length
  const scored = allCompanies.filter(c => scoresMap?.[c.id] !== undefined)
  const sectorAvg = scored.length > 0
    ? Math.round(scored.reduce((s, c) => s + (scoresMap![c.id] ?? 0), 0) / scored.length * 10) / 10
    : null
  const highConviction = scored.filter(c => (scoresMap![c.id] ?? 0) >= 8).length
  const outOfScope = allCompanies.filter(c => !TARGET_STAGES.has(c.stage) && !['Bootstrapped'].includes(c.stage)).length

  // Top picks per segment (score ≥ 7, target stage, sorted by score desc)
  function topPicks(seg: Segment): Company[] {
    return seg.companies
      .filter(c => TARGET_STAGES.has(c.stage) && (scoresMap?.[c.id] ?? 0) >= 7)
      .sort((a, b) => (scoresMap?.[b.id] ?? 0) - (scoresMap?.[a.id] ?? 0))
      .slice(0, 3)
  }

  return (
    <div>
      {/* Sector Intelligence Bar */}
      <div className="mb-5 p-4 bg-terrain-surface border border-terrain-border rounded-lg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-terrain-muted text-[9px] font-mono uppercase tracking-widest mb-0.5">Total Companies</div>
              <div className="text-terrain-text text-lg font-bold font-mono">{allCompanies.length}</div>
            </div>
            <div>
              <div className="text-terrain-muted text-[9px] font-mono uppercase tracking-widest mb-0.5">Early-Stage (Target)</div>
              <div className="text-emerald-400 text-lg font-bold font-mono">{totalEarlyStage}</div>
            </div>
            {sectorAvg !== null && (
              <div>
                <div className="text-terrain-muted text-[9px] font-mono uppercase tracking-widest mb-0.5">Sector Avg Score</div>
                <div className="text-lg font-bold font-mono" style={{ color: scoreToColor(sectorAvg) }}>{sectorAvg}</div>
              </div>
            )}
            <div>
              <div className="text-terrain-muted text-[9px] font-mono uppercase tracking-widest mb-0.5">High Conviction (≥8)</div>
              <div className="text-terrain-gold text-lg font-bold font-mono">{highConviction}</div>
            </div>
            <div>
              <div className="text-terrain-muted text-[9px] font-mono uppercase tracking-widest mb-0.5">Out of Scope (B+)</div>
              <div className="text-red-400/70 text-lg font-bold font-mono">{outOfScope}</div>
            </div>
          </div>

          {!allLoaded && (
            <button
              onClick={loadAllCompanies}
              disabled={loadingAll}
              className="flex items-center gap-2 text-xs font-mono border border-terrain-goldBorder text-terrain-gold px-4 py-1.5 rounded hover:bg-terrain-goldDim transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingAll ? (
                <><span className="w-3 h-3 border border-terrain-gold border-t-transparent rounded-full animate-spin" />Loading all…</>
              ) : 'Load all companies →'}
            </button>
          )}
          {allLoaded && (
            <span className="text-terrain-gold text-[10px] font-mono border border-terrain-goldBorder px-2 py-0.5 rounded">✓ All loaded</span>
          )}
        </div>

        {/* Stage distribution bar */}
        {allCompanies.length > 0 && (() => {
          const stageCounts: Record<string, number> = {}
          allCompanies.forEach(c => { stageCounts[c.stage] = (stageCounts[c.stage] ?? 0) + 1 })
          const stageOrder = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Public', 'Bootstrapped', 'Acquired']
          const stageColors: Record<string, string> = {
            'Pre-Seed': '#475569', 'Seed': '#065f46', 'Series A': '#1e3a5f',
            'Series B': '#3b0764', 'Series C': '#7c2d12', 'Series D+': '#7f1d1d',
            'Public': '#713f12', 'Bootstrapped': '#134e4a', 'Acquired': '#292524',
          }
          return (
            <div className="mt-3 pt-3 border-t border-terrain-border/60">
              <div className="text-terrain-muted text-[9px] font-mono uppercase tracking-widest mb-2">Stage Distribution</div>
              <div className="flex items-center gap-1 flex-wrap">
                {stageOrder.filter(s => stageCounts[s]).map(stage => (
                  <div key={stage} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: stageColors[stage] ?? '#374151' }} />
                    <span className={`text-[9px] font-mono ${TARGET_STAGES.has(stage) ? 'text-terrain-text' : 'text-terrain-muted'}`}>
                      {stage} ({stageCounts[stage]})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Main heatmap table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: '900px' }}>
          <thead>
            <tr className="bg-terrain-surface">
              <th className="text-left px-4 py-3 text-terrain-muted text-[10px] font-mono uppercase tracking-widest border-b border-terrain-border w-52">
                Segment
              </th>
              {MOMENTUM_COLS.map(col => (
                <th key={col.key} className="px-2 py-3 text-center border-b border-terrain-border w-36">
                  <div className="text-base">{col.emoji}</div>
                  <div className="text-terrain-text text-[10px] font-mono font-semibold">{col.label}</div>
                  <div className="text-terrain-muted text-[9px] font-mono opacity-70">{col.mucker}</div>
                </th>
              ))}
              <th className="px-2 py-3 text-center border-b border-terrain-border w-36 border-l border-terrain-border/60">
                <div className="text-base">⭐</div>
                <div className="text-terrain-gold text-[10px] font-mono font-semibold">Top Picks</div>
                <div className="text-terrain-muted text-[9px] font-mono opacity-70">Score ≥7 · Early</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, i) => {
              const picks = topPicks(seg)
              return (
                <tr key={seg.id} className={i % 2 === 0 ? '' : 'bg-white/[0.015]'}>
                  {/* Segment info cell */}
                  <td className="px-4 py-3 align-top border-b border-terrain-border/40">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-terrain-text text-xs font-mono font-bold leading-tight">{seg.name}</span>
                      {loadingIds.has(seg.id) && (
                        <span className="w-2.5 h-2.5 border border-terrain-gold border-t-transparent rounded-full animate-spin ml-1" />
                      )}
                    </div>
                    <p className="text-terrain-muted text-[9px] font-mono leading-relaxed mb-1.5 line-clamp-2">
                      {seg.description}
                    </p>
                    <SegmentStats seg={seg} scoresMap={scoresMap} />
                    <button
                      onClick={() => navigate('/segment', { state: { sector: map.sector, segmentName: seg.name, segmentDescription: seg.description, segmentColor: seg.color } })}
                      className="text-[9px] font-mono text-terrain-muted hover:text-terrain-gold transition-colors mt-2 block"
                    >
                      View all →
                    </button>
                  </td>

                  {/* Momentum columns */}
                  {MOMENTUM_COLS.map(col => {
                    const companies = seg.companies.filter(c => c.momentum_signal === col.key)
                    const targetHere = companies.filter(c => TARGET_STAGES.has(c.stage))
                    return (
                      <td key={col.key} className="px-1.5 py-2 align-top border-b border-terrain-border/40">
                        {companies.length > 0 && (
                          <div className="text-terrain-muted text-[9px] font-mono mb-1.5 px-1">
                            {companies.length} co. · {targetHere.length} early
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          {companies.map(company => (
                            <CompanyChip
                              key={company.id}
                              company={company}
                              scoresMap={scoresMap}
                              onClick={() => onCompanyClick(company)}
                            />
                          ))}
                        </div>
                      </td>
                    )
                  })}

                  {/* Top Picks column */}
                  <td className="px-1.5 py-2 align-top border-b border-terrain-border/40 border-l border-terrain-border/40 bg-terrain-goldDim/10">
                    {picks.length === 0 ? (
                      <div className="text-terrain-muted/40 text-[9px] font-mono px-1 pt-1">—</div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {picks.map(company => (
                          <CompanyChip
                            key={company.id}
                            company={company}
                            scoresMap={scoresMap}
                            onClick={() => onCompanyClick(company)}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Summary footer */}
          <tfoot>
            <tr className="bg-terrain-surface/60">
              <td className="px-4 py-3 text-terrain-muted text-[10px] font-mono border-t border-terrain-border">
                <div className="font-semibold text-terrain-text">Sector Totals</div>
                <div className="text-[9px] mt-0.5">{allCompanies.length} companies</div>
              </td>
              {MOMENTUM_COLS.map(col => {
                const count = segments.reduce((n, s) => n + s.companies.filter(c => c.momentum_signal === col.key).length, 0)
                const targetCount = segments.reduce((n, s) => n + s.companies.filter(c => c.momentum_signal === col.key && TARGET_STAGES.has(c.stage)).length, 0)
                return (
                  <td key={col.key} className="px-2 py-3 text-center border-t border-terrain-border">
                    <div className="text-terrain-text text-xs font-bold font-mono">{count}</div>
                    <div className="text-terrain-muted text-[9px] font-mono">{targetCount} early</div>
                  </td>
                )
              })}
              <td className="px-2 py-3 text-center border-t border-terrain-border border-l border-terrain-border/40">
                <div className="text-terrain-gold text-xs font-bold font-mono">
                  {segments.reduce((n, s) => n + topPicks(s).length, 0)}
                </div>
                <div className="text-terrain-muted text-[9px] font-mono">total picks</div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mucker legend */}
      <div className="mt-4 pt-4 border-t border-terrain-border/40 flex items-center gap-6 flex-wrap">
        <span className="text-terrain-muted text-[9px] font-mono uppercase tracking-wider">Mucker lens:</span>
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400"><span className="w-2 h-2 rounded-sm bg-emerald-900 border border-emerald-700" /> Pre-Seed / Seed / Series A = target</span>
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-red-400/60"><span className="w-2 h-2 rounded-sm bg-red-900/40 border border-red-800/40" /> Series B+ = out of scope</span>
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-terrain-gold"><span className="w-2 h-2 rounded-sm bg-terrain-goldDim border border-terrain-goldBorder" /> Score ≥8 = high conviction</span>
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-terrain-muted"><span className="w-2 h-2 rounded-sm bg-terrain-surface border border-terrain-border" /> Dimmed = wrong stage</span>
      </div>
    </div>
  )
}
