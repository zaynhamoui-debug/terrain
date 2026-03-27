import { useState } from 'react'
import { generateMarketMap } from '../lib/claudeApi'
import { MarketMap, Company } from '../types/marketMap'
import SegmentRow from './SegmentRow'
import SearchBar from './SearchBar'

const LOADING_MESSAGES = [
  'Scanning sector…', 'Mapping players…', 'Enriching data…', 'Synthesizing…',
]

interface SideState {
  map: MarketMap | null
  loading: boolean
  error: string | null
  msgIdx: number
}

interface Props {
  onCompanyClick: (company: Company) => void
}

function MapSide({ side, onSearch, onCompanyClick }: {
  side: SideState
  onSearch: (q: string) => void
  onCompanyClick: (company: Company) => void
}) {
  return (
    <div className="flex-1 min-w-0 border-r border-terrain-border last:border-r-0 px-6 py-4 overflow-y-auto">
      <SearchBar onSearch={onSearch} isLoading={side.loading} />

      {side.loading && (
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="w-8 h-8 border border-terrain-border rounded-full relative">
            <div className="absolute inset-0 border-t border-terrain-gold rounded-full animate-spin" />
          </div>
          <p className="text-terrain-muted text-xs font-mono">{LOADING_MESSAGES[side.msgIdx]}</p>
        </div>
      )}

      {side.error && !side.loading && (
        <div className="mt-4 p-3 border border-red-900/50 rounded text-red-400 text-xs font-mono">{side.error}</div>
      )}

      {side.map && !side.loading && (
        <div className="mt-6">
          <div className="mb-4 pb-4 border-b border-terrain-border">
            <h3 className="font-display text-2xl font-bold text-terrain-text">{side.map.sector}</h3>
            <div className="text-terrain-gold text-sm font-mono mt-1">{side.map.total_market_size}</div>
          </div>
          {side.map.segments.map(seg => (
            <SegmentRow key={seg.id} segment={seg} sector={side.map!.sector} onCompanyClick={onCompanyClick} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CompareView({ onCompanyClick }: Props) {
  const [left,  setLeft]  = useState<SideState>({ map: null, loading: false, error: null, msgIdx: 0 })
  const [right, setRight] = useState<SideState>({ map: null, loading: false, error: null, msgIdx: 0 })

  async function search(side: 'left' | 'right', query: string) {
    const set = side === 'left' ? setLeft : setRight

    set(s => ({ ...s, loading: true, error: null, msgIdx: 0 }))

    const iv = setInterval(() => {
      set(s => ({ ...s, msgIdx: (s.msgIdx + 1) % LOADING_MESSAGES.length }))
    }, 1800)

    try {
      const map = await generateMarketMap(query)
      set(s => ({ ...s, map, loading: false }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate map'
      set(s => ({ ...s, error: msg, loading: false }))
    } finally {
      clearInterval(iv)
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] divide-x divide-terrain-border overflow-hidden -mx-6">
      <MapSide side={left}  onSearch={q => search('left',  q)} onCompanyClick={onCompanyClick} />
      <MapSide side={right} onSearch={q => search('right', q)} onCompanyClick={onCompanyClick} />
    </div>
  )
}
