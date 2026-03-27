import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarketMap, Segment, Company } from '../types/marketMap'
import { searchAndEnrichSegment } from '../lib/claudeApi'

const MOMENTUM_COLS = [
  { key: '🚀 Hypergrowth', emoji: '🚀', label: 'Hypergrowth' },
  { key: '📈 Growing',     emoji: '📈', label: 'Growing'     },
  { key: '➡️ Stable',     emoji: '➡️', label: 'Stable'      },
  { key: '⚠️ Challenged', emoji: '⚠️', label: 'Challenged'  },
  { key: '🔒 Stealth',    emoji: '🔒', label: 'Stealth'     },
] as const

interface Props {
  map: MarketMap
  onCompanyClick: (company: Company) => void
}

export default function HeatmapView({ map, onCompanyClick }: Props) {
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
          // Merge with existing — deduplicate by id
          const existing = seg.companies
          const existingIds = new Set(existing.map(c => c.id))
          const newOnes = companies.filter(c => !existingIds.has(c.id))
          return { ...seg, companies: [...existing, ...newOnes] }
        } catch {
          return seg
        } finally {
          setLoadingIds(prev => { const n = new Set(prev); n.delete(seg.id); return n })
        }
      })
    )

    setSegments(updated)
    setLoadingAll(false)
    setAllLoaded(true)
  }

  const totalCompanies = segments.reduce((n, s) => n + s.companies.length, 0)

  return (
    <div>
      {/* Header row with load-all button */}
      <div className="flex items-center justify-between mb-4 py-3 border-b border-terrain-border">
        <div className="flex items-center gap-3">
          <span className="text-terrain-muted text-xs font-mono">
            {totalCompanies} companies across {segments.length} segments
          </span>
          {allLoaded && (
            <span className="text-terrain-gold text-[10px] font-mono border border-terrain-goldBorder px-2 py-0.5 rounded">
              ✓ All loaded
            </span>
          )}
        </div>

        {!allLoaded && (
          <button
            onClick={loadAllCompanies}
            disabled={loadingAll}
            className="flex items-center gap-2 text-xs font-mono border border-terrain-goldBorder text-terrain-gold px-4 py-1.5 rounded hover:bg-terrain-goldDim transition-colors disabled:opacity-50"
          >
            {loadingAll ? (
              <>
                <span className="w-3 h-3 border border-terrain-gold border-t-transparent rounded-full animate-spin" />
                Loading all companies…
              </>
            ) : (
              'Load all companies in sector →'
            )}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-terrain-muted text-[10px] font-mono uppercase tracking-widest border-b border-terrain-border w-48">
                Segment
              </th>
              {MOMENTUM_COLS.map(col => (
                <th key={col.key} className="px-3 py-3 text-center border-b border-terrain-border">
                  <div className="text-lg">{col.emoji}</div>
                  <div className="text-terrain-muted text-[10px] font-mono mt-0.5">{col.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, i) => (
              <tr key={seg.id} className={i % 2 === 0 ? '' : 'bg-white/[0.01]'}>
                <td className="px-4 py-3 align-top border-b border-terrain-border/40">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <span className="text-terrain-text text-xs font-mono font-semibold leading-tight">
                      {seg.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-terrain-muted text-[9px] font-mono">{seg.companies.length} co.</span>
                    {loadingIds.has(seg.id) && (
                      <span className="w-2.5 h-2.5 border border-terrain-gold border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  <button
                    onClick={() => navigate('/segment', { state: { sector: map.sector, segmentName: seg.name, segmentDescription: seg.description, segmentColor: seg.color } })}
                    className="text-[10px] font-mono text-terrain-muted hover:text-terrain-gold transition-colors mt-1 block"
                  >
                    View all →
                  </button>
                </td>
                {MOMENTUM_COLS.map(col => {
                  const companies = seg.companies.filter(c => c.momentum_signal === col.key)
                  return (
                    <td key={col.key} className="px-2 py-2 align-top border-b border-terrain-border/40">
                      <div className="flex flex-col gap-1">
                        {companies.map(company => (
                          <button
                            key={company.id}
                            onClick={() => onCompanyClick(company)}
                            className={`text-left px-2 py-1.5 rounded text-[11px] font-mono leading-tight transition-all hover:scale-[1.02] ${
                              company.is_focal_company
                                ? 'bg-terrain-goldDim border border-terrain-goldBorder text-terrain-gold'
                                : 'bg-terrain-surface border border-terrain-border text-terrain-text hover:border-terrain-subtle'
                            }`}
                          >
                            {company.name}
                            {company.funding_display && (
                              <span className="block text-terrain-muted text-[10px] mt-0.5">
                                {company.funding_display}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
