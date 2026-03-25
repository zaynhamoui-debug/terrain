import { MarketMap, Company } from '../types/marketMap'

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
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[700px]">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 text-terrain-muted text-[10px] font-mono uppercase tracking-widest border-b border-terrain-border w-44">
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
          {map.segments.map((seg, i) => (
            <tr key={seg.id} className={i % 2 === 0 ? '' : 'bg-white/[0.01]'}>
              <td className="px-4 py-3 align-top border-b border-terrain-border/40">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-terrain-text text-xs font-mono font-semibold leading-tight">
                    {seg.name}
                  </span>
                </div>
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
  )
}
