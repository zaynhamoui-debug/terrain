import { Segment } from '../types/marketMap'

interface Props {
  segments: Segment[]
}

const STAGE_COLORS: Record<string, string> = {
  'Pre-Seed':    '#64748b', // slate-500
  'Seed':        '#34d399', // emerald-400
  'Series A':    '#60a5fa', // blue-400
  'Series B':    '#a78bfa', // violet-400
  'Series C':    '#fb923c', // orange-400
  'Series D+':   '#f87171', // red-400
  'Public':      '#facc15', // yellow-400
  'Acquired':    '#a8a29e', // stone-400
  'Bootstrapped':'#2dd4bf', // teal-400
}

const STAGE_ORDER = [
  'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+',
  'Public', 'Bootstrapped', 'Acquired',
]

function formatFunding(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`
  if (usd >= 1_000_000)     return `$${(usd / 1_000_000).toFixed(0)}M`
  if (usd >= 1_000)         return `$${(usd / 1_000).toFixed(0)}K`
  return `$${usd}`
}

export default function FundingChart({ segments }: Props) {
  // Aggregate funding by stage
  const stageMap: Record<string, number> = {}
  for (const seg of segments) {
    for (const company of seg.companies) {
      if (company.total_funding_usd > 0) {
        stageMap[company.stage] = (stageMap[company.stage] ?? 0) + company.total_funding_usd
      }
    }
  }

  const entries = STAGE_ORDER
    .filter(s => (stageMap[s] ?? 0) > 0)
    .map(s => ({ stage: s, total: stageMap[s] }))

  if (entries.length === 0) return null

  const maxTotal = Math.max(...entries.map(e => e.total))

  return (
    <div className="mb-8 px-5 py-4 bg-terrain-surface border border-terrain-border rounded-lg">
      <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-4">
        Funding by Stage
      </div>
      <div className="space-y-2.5">
        {entries.map(({ stage, total }) => {
          const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
          const color = STAGE_COLORS[stage] ?? '#c9a84c'
          return (
            <div key={stage} className="flex items-center gap-3">
              <div className="w-20 shrink-0 text-[10px] font-mono text-terrain-muted text-right truncate">
                {stage}
              </div>
              <div className="flex-1 h-3 bg-terrain-bg rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <div className="w-14 shrink-0 text-[10px] font-mono text-terrain-text">
                {formatFunding(total)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
