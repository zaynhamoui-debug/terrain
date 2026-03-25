import { KeyTrend } from '../types/marketMap'

interface Props {
  trends: KeyTrend[]
}

export default function KeyTrends({ trends }: Props) {
  if (!trends?.length) return null

  return (
    <div className="bg-terrain-surface border border-terrain-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-terrain-gold text-lg">↗</span>
        <h3 className="font-display text-base font-semibold text-terrain-text">
          Key Trends
        </h3>
        <span className="text-terrain-muted text-xs font-mono ml-auto">
          {trends.length} signals
        </span>
      </div>
      <div className="space-y-4">
        {trends.map((trend, i) => (
          <div key={i} className="border-l-2 border-terrain-subtle pl-4">
            <div className="text-terrain-text text-sm font-semibold font-mono mb-1">
              {trend.title}
            </div>
            <div className="text-terrain-muted text-xs font-mono leading-relaxed">
              {trend.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
