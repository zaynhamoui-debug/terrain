import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Company } from '../types/marketMap'
import { supabase } from '../lib/supabase'
import { scoreCompanies } from '../lib/claudeApi'
import CompanyCard from '../components/CompanyCard'
import CompanyModal from '../components/CompanyModal'

interface TrackingRow {
  company_id: string
  company_data: Company
  status: 'viewed' | 'targeted'
  sector: string
}

export default function TargetedPage() {
  const navigate = useNavigate()
  const [targeted,       setTargeted]       = useState<TrackingRow[]>([])
  const [loading,        setLoading]        = useState(true)
  const [selected,       setSelected]       = useState<Company | null>(null)
  const [selectedSector, setSelectedSector] = useState<string>('')
  const [watchlistIds,   setWatchlistIds]   = useState<Set<string>>(new Set())
  const [dealFlowMap,    setDealFlowMap]    = useState<Record<string, string>>({})
  const [scoresMap,      setScoresMap]      = useState<Record<string, number>>({})
  const [search,         setSearch]         = useState('')

  useEffect(() => {
    fetchTargeted()
    fetchWatchlist()
    fetchDealFlow()
  }, [])

  async function fetchTargeted() {
    setLoading(true)
    const { data } = await supabase
      .from('company_tracking')
      .select('company_id, company_data, status, sector')
      .eq('status', 'targeted')
      .order('updated_at', { ascending: false })
    if (data) {
      setTargeted(data as TrackingRow[])
      const companies = data.map((r: TrackingRow) => r.company_data)
      scoreCompanies(companies).then(scores => setScoresMap(scores))
    }
    setLoading(false)
  }

  async function fetchWatchlist() {
    const { data } = await supabase.from('watchlist').select('company_id')
    if (data) setWatchlistIds(new Set(data.map((r: { company_id: string }) => r.company_id)))
  }

  async function fetchDealFlow() {
    const { data } = await supabase.from('deal_flow').select('company_id, status')
    if (data) {
      const map: Record<string, string> = {}
      for (const row of data as { company_id: string; status: string }[]) map[row.company_id] = row.status
      setDealFlowMap(map)
    }
  }

  async function handleToggleWatchlist(company: Company) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (watchlistIds.has(company.id)) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('company_id', company.id)
      setWatchlistIds(prev => { const n = new Set(prev); n.delete(company.id); return n })
    } else {
      await supabase.from('watchlist').insert({ user_id: user.id, company_id: company.id, company_data: company, sector: '' })
      setWatchlistIds(prev => new Set([...prev, company.id]))
    }
  }

  async function handleToggleTracking(company: Company, status: 'viewed' | 'targeted') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existing = targeted.find(r => r.company_id === company.id)
    if (existing?.status === status) {
      // untarget — remove from page
      await supabase.from('company_tracking').delete().eq('user_id', user.id).eq('company_id', company.id)
      setTargeted(prev => prev.filter(r => r.company_id !== company.id))
      setSelected(null)
    } else {
      await supabase.from('company_tracking').upsert(
        { user_id: user.id, company_id: company.id, company_data: company, status, sector: selectedSector, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,company_id' }
      )
      setTargeted(prev => prev.map(r => r.company_id === company.id ? { ...r, status } : r))
    }
  }

  const filtered = targeted.filter(r =>
    !search ||
    r.company_data.name.toLowerCase().includes(search.toLowerCase()) ||
    r.company_data.tagline?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-terrain-bg text-terrain-text font-mono">
      <header className="sticky top-0 z-20 border-b border-terrain-border bg-terrain-bg/90 backdrop-blur px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/app')}
          className="text-terrain-muted hover:text-terrain-gold text-xs font-mono transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-[0.2em]">TERRAIN</span>
          <span className="text-terrain-muted text-[10px] uppercase tracking-widest">Targeted Companies</span>
        </div>
        {!loading && (
          <span className="ml-auto text-xs font-mono text-terrain-muted">
            {filtered.length} companies
          </span>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!loading && targeted.length > 0 && (
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter targeted companies…"
              className="w-full max-w-sm bg-terrain-surface border border-terrain-border rounded px-4 py-2 text-terrain-text text-xs font-mono focus:outline-none focus:border-terrain-gold transition-colors placeholder-terrain-muted"
            />
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
              <div className="w-10 h-10 border border-terrain-border rounded-full" />
              <div className="absolute inset-0 w-10 h-10 border-t border-terrain-gold rounded-full animate-spin" />
            </div>
            <p className="text-terrain-muted text-sm font-mono">Loading targeted companies…</p>
          </div>
        )}

        {!loading && targeted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="text-terrain-muted text-5xl">⊙</div>
            <p className="text-terrain-text font-display text-xl">No targeted companies yet</p>
            <p className="text-terrain-muted text-sm font-mono max-w-sm">
              Open any company and click "Mark Targeted" to add it here.
            </p>
            <button
              onClick={() => navigate('/app')}
              className="mt-2 text-terrain-gold text-xs font-mono border border-terrain-goldBorder px-4 py-2 rounded hover:bg-terrain-goldDim transition-colors"
            >
              Browse Market Maps →
            </button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(row => (
              <CompanyCard
                key={row.company_id}
                company={row.company_data}
                onSelect={c => { setSelected(c); setSelectedSector(row.sector) }}
                isWatchlisted={watchlistIds.has(row.company_id)}
                onToggleWatchlist={handleToggleWatchlist}
                dealStatus={dealFlowMap[row.company_id]}
                score={scoresMap[row.company_id]}
                trackingStatus="targeted"
              />
            ))}
          </div>
        )}

        {!loading && search && filtered.length === 0 && targeted.length > 0 && (
          <p className="text-terrain-muted text-sm font-mono text-center py-10">No companies match "{search}"</p>
        )}
      </div>

      {selected && (
        <CompanyModal
          company={selected}
          sector={selectedSector}
          mapId={null}
          onClose={() => setSelected(null)}
          isWatchlisted={watchlistIds.has(selected.id)}
          onToggleWatchlist={handleToggleWatchlist}
          score={scoresMap[selected.id]}
          trackingStatus={targeted.find(r => r.company_id === selected.id)?.status}
          onToggleTracking={handleToggleTracking}
          onSetDealStatus={() => {}}
        />
      )}
    </div>
  )
}
