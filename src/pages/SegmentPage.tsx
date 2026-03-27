import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Company } from '../types/marketMap'
import { searchAndEnrichSegment, scoreCompanies } from '../lib/claudeApi'
import CompanyCard from '../components/CompanyCard'
import CompanyModal from '../components/CompanyModal'
import { supabase } from '../lib/supabase'
import { WatchlistItem } from '../components/WatchlistPanel'

interface SegmentState {
  sector: string
  segmentName: string
  segmentDescription: string
  segmentColor: string
}

export default function SegmentPage() {
  const location   = useLocation()
  const navigate   = useNavigate()
  const state      = location.state as SegmentState | null

  const [companies,       setCompanies]       = useState<Company[]>([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [watchlistIds,    setWatchlistIds]    = useState<Set<string>>(new Set())
  const [dealFlowMap,     setDealFlowMap]     = useState<Record<string, string>>({})
  const [scoresMap,       setScoresMap]       = useState<Record<string, number>>({})
  const [trackingMap,     setTrackingMap]     = useState<Record<string, 'viewed' | 'targeted'>>({})
  const [search,          setSearch]          = useState('')

  useEffect(() => {
    if (!state) { navigate('/app'); return }
    load()
    fetchWatchlist()
    fetchDealFlow()
    fetchTracking()
  }, [])

  async function load() {
    if (!state) return
    setLoading(true)
    setError(null)
    try {
      const result = await searchAndEnrichSegment(state.sector, state.segmentName, state.segmentDescription)
      setCompanies(result)
      // Score in background
      scoreCompanies(result).then(scores => setScoresMap(scores))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
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

  async function fetchTracking() {
    const { data } = await supabase.from('company_tracking').select('company_id, status')
    if (data) {
      const map: Record<string, 'viewed' | 'targeted'> = {}
      for (const row of data as { company_id: string; status: 'viewed' | 'targeted' }[]) map[row.company_id] = row.status
      setTrackingMap(map)
    }
  }

  async function handleToggleWatchlist(company: Company) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (watchlistIds.has(company.id)) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('company_id', company.id)
      setWatchlistIds(prev => { const n = new Set(prev); n.delete(company.id); return n })
    } else {
      await supabase.from('watchlist').insert({ user_id: user.id, company_id: company.id, company_data: company, sector: state?.sector ?? '' })
      setWatchlistIds(prev => new Set([...prev, company.id]))
    }
  }

  async function handleToggleTracking(company: Company, status: 'viewed' | 'targeted') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const existing = trackingMap[company.id]
    if (existing === status) {
      // toggle off
      await supabase.from('company_tracking').delete().eq('user_id', user.id).eq('company_id', company.id)
      setTrackingMap(prev => { const n = { ...prev }; delete n[company.id]; return n })
    } else {
      await supabase.from('company_tracking').upsert(
        { user_id: user.id, company_id: company.id, company_data: company, status, sector: state?.sector ?? '', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,company_id' }
      )
      setTrackingMap(prev => ({ ...prev, [company.id]: status }))
    }
  }

  const filtered = companies.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.tagline?.toLowerCase().includes(search.toLowerCase())
  )

  if (!state) return null

  return (
    <div className="min-h-screen bg-terrain-bg text-terrain-text font-mono">
      <header className="sticky top-0 z-20 border-b border-terrain-border bg-terrain-bg/90 backdrop-blur px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-terrain-muted hover:text-terrain-gold text-xs font-mono transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: state.segmentColor }} />
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold text-terrain-text truncate">{state.segmentName}</h1>
            <p className="text-terrain-muted text-[11px] font-mono truncate">{state.sector} · {state.segmentDescription}</p>
          </div>
        </div>
        {!loading && (
          <span className="ml-auto shrink-0 text-xs font-mono text-terrain-muted">
            {filtered.length} companies
          </span>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!loading && companies.length > 0 && (
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter companies…"
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
            <p className="text-terrain-muted text-sm font-mono">Loading all companies in this segment…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <button onClick={load} className="text-terrain-gold text-xs font-mono border border-terrain-goldBorder px-4 py-2 rounded hover:bg-terrain-goldDim transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && companies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-terrain-muted text-4xl mb-4">⬡</div>
            <p className="text-terrain-muted text-sm font-mono">No companies found for this segment.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                onSelect={setSelectedCompany}
                isWatchlisted={watchlistIds.has(company.id)}
                onToggleWatchlist={handleToggleWatchlist}
                dealStatus={dealFlowMap[company.id]}
                score={scoresMap[company.id]}
                trackingStatus={trackingMap[company.id]}
              />
            ))}
          </div>
        )}

        {!loading && search && filtered.length === 0 && companies.length > 0 && (
          <p className="text-terrain-muted text-sm font-mono text-center py-10">No companies match "{search}"</p>
        )}
      </div>

      {selectedCompany && (
        <CompanyModal
          company={selectedCompany}
          sector={state.sector}
          mapId={null}
          onClose={() => setSelectedCompany(null)}
          onSetDealStatus={() => {}}
          score={scoresMap[selectedCompany.id]}
          trackingStatus={trackingMap[selectedCompany.id]}
          onToggleTracking={handleToggleTracking}
        />
      )}
    </div>
  )
}
