import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MarketMap, Company } from '../types/marketMap'
import SegmentRow  from '../components/SegmentRow'
import WhiteSpaces from '../components/WhiteSpaces'
import KeyTrends   from '../components/KeyTrends'
import CompanyModal from '../components/CompanyModal'

export default function SharedMap() {
  const { id } = useParams<{ id: string }>()
  const [map,     setMap]     = useState<MarketMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [selected, setSelected] = useState<Company | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('saved_maps')
      .select('map_data, query')
      .eq('id', id)
      .eq('is_public', true)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Map not found or not public.')
        else setMap(data.map_data as MarketMap)
        setLoading(false)
      })
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-terrain-bg flex items-center justify-center">
      <div className="w-8 h-8 border border-terrain-border rounded-full relative">
        <div className="absolute inset-0 border-t border-terrain-gold rounded-full animate-spin" />
      </div>
    </div>
  )

  if (error || !map) return (
    <div className="min-h-screen bg-terrain-bg flex flex-col items-center justify-center gap-4">
      <p className="text-terrain-muted font-mono text-sm">{error ?? 'Map not found.'}</p>
      <Link to="/" className="text-terrain-gold text-xs font-mono hover:underline">← Back to TERRAIN</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-terrain-bg text-terrain-text font-mono">
      <header className="border-b border-terrain-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-xl font-bold tracking-[0.2em]">TERRAIN</span>
          <span className="text-terrain-muted text-[10px] uppercase tracking-widest">Shared Map</span>
        </div>
        <Link
          to="/register"
          className="px-4 py-2 rounded bg-terrain-gold text-terrain-bg text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
        >
          Get Access →
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-8 mb-8 pb-8 border-b border-terrain-border">
          <div>
            <h1 className="font-display text-4xl font-bold text-terrain-text">{map.sector}</h1>
            <p className="text-terrain-muted text-sm font-mono mt-3 max-w-2xl leading-relaxed">{map.summary}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-terrain-gold font-display text-2xl font-bold">{map.total_market_size}</div>
          </div>
        </div>

        {map.segments.map(seg => (
          <SegmentRow key={seg.id} segment={seg} onCompanyClick={setSelected} />
        ))}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          <WhiteSpaces spaces={map.white_spaces} />
          <KeyTrends   trends={map.key_trends} />
        </div>
      </div>

      {selected && (
        <CompanyModal company={selected} mapId={null} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
