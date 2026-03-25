import { Company } from '../types/marketMap'

export interface WatchlistItem {
  id: string
  company_id: string
  company_data: Company
  sector: string
  created_at: string
}

interface Props {
  items: WatchlistItem[]
  onCompanyClick: (company: Company) => void
  onRemove: (companyId: string) => void
  onClose: () => void
}

export default function WatchlistPanel({ items, onCompanyClick, onRemove, onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[380px] bg-terrain-surface border-l border-terrain-border z-40 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-terrain-border">
          <div>
            <h2 className="font-display text-xl font-semibold text-terrain-text">Watchlist</h2>
            <p className="text-terrain-muted text-xs font-mono mt-0.5">{items.length} pinned</p>
          </div>
          <button onClick={onClose} className="text-terrain-muted hover:text-terrain-text text-2xl transition-colors">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4 opacity-40">♡</div>
              <p className="text-terrain-muted text-sm font-mono">No companies pinned.</p>
              <p className="text-terrain-muted text-xs font-mono mt-1 opacity-60">
                Click ♥ on any company card.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.id}
                  className="bg-terrain-bg border border-terrain-border rounded-lg p-4 hover:border-terrain-subtle transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      className="text-left min-w-0 flex-1"
                      onClick={() => onCompanyClick(item.company_data)}
                    >
                      <div className="font-display font-semibold text-terrain-text group-hover:text-terrain-gold transition-colors truncate">
                        {item.company_data.name}
                      </div>
                      <div className="text-terrain-muted text-xs font-mono mt-0.5 truncate">
                        {item.company_data.tagline}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-terrain-gold text-xs font-mono font-bold">
                          {item.company_data.funding_display}
                        </span>
                        <span className="text-terrain-muted text-[10px] font-mono">·</span>
                        <span className="text-terrain-muted text-[10px] font-mono">{item.sector}</span>
                      </div>
                    </button>
                    <button
                      onClick={() => onRemove(item.company_id)}
                      className="text-terrain-gold hover:text-terrain-muted transition-colors shrink-0 text-lg leading-none mt-0.5"
                      title="Remove from watchlist"
                    >
                      ♥
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-terrain-border">
          <p className="text-terrain-muted text-[10px] font-mono text-center">
            Press <kbd className="bg-terrain-bg border border-terrain-border px-1 rounded">W</kbd> to toggle
          </p>
        </div>
      </div>
    </>
  )
}
