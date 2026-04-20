import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateMarketMap, analyzeCompanyLandscape, scoreCompanies } from '../lib/claudeApi'
import { MarketMap, Company, SavedMap } from '../types/marketMap'
import SearchBar, { SearchMode } from '../components/SearchBar'
import SegmentRow   from '../components/SegmentRow'
import WhiteSpaces  from '../components/WhiteSpaces'
import KeyTrends    from '../components/KeyTrends'
import CompanyModal from '../components/CompanyModal'
import CompareView  from '../components/CompareView'
import HeatmapView  from '../components/HeatmapView'
import WatchlistPanel, { WatchlistItem } from '../components/WatchlistPanel'
import MapChat from '../components/MapChat'
import FundingChart from '../components/FundingChart'
import DealFlowPipeline from '../components/DealFlowPipeline'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { exportCSV, printMap } from '../lib/export'

const LOADING_MESSAGES = [
  'Scanning sector landscape…',
  'Mapping competitive dynamics…',
  'Enriching funding data…',
  'Identifying white spaces…',
  'Analyzing momentum signals…',
  'Cross-referencing market signals…',
  'Synthesizing intelligence…',
  'Validating company profiles…',
]

const COMPANY_LOADING_MESSAGES = [
  'Identifying competitors…',
  'Mapping competitive landscape…',
  'Categorizing market tiers…',
  'Analyzing field leaders…',
  'Profiling challengers…',
  'Spotting up and comers…',
  'Synthesizing intelligence…',
  'Building landscape view…',
]

type ViewMode = 'grid' | 'heatmap' | 'compare' | 'pipeline'

export default function AppPage() {
  const navigate = useNavigate()

  const [currentMap,      setCurrentMap]      = useState<MarketMap | null>(null)
  const [currentMapId,    setCurrentMapId]     = useState<string | null>(null)
  const [isLoading,       setIsLoading]        = useState(false)
  const [loadingMsgIdx,   setLoadingMsgIdx]    = useState(0)
  const [activeSegment,   setActiveSegment]    = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany]  = useState<Company | null>(null)
  const [savedMaps,       setSavedMaps]        = useState<SavedMap[]>([])
  const [error,           setError]            = useState<string | null>(null)
  const [userEmail,       setUserEmail]        = useState<string>('')

  // New state
  const [viewMode,        setViewMode]         = useState<ViewMode>('grid')
  const [showWatchlist,   setShowWatchlist]    = useState(false)
  const [watchlistItems,  setWatchlistItems]   = useState<WatchlistItem[]>([])
  const [watchlistIds,    setWatchlistIds]     = useState<Set<string>>(new Set())
  const [showExportMenu,  setShowExportMenu]   = useState(false)
  const [shareStatus,     setShareStatus]      = useState<'idle' | 'sharing' | 'copied'>('idle')
  const [showChat,        setShowChat]         = useState(false)
  const [chatInitialQ,    setChatInitialQ]     = useState<string | undefined>(undefined)
  const [stageFilter,     setStageFilter]      = useState<string[]>([])
  const [headcountFilter, setHeadcountFilter]  = useState<string[]>([])
  const [hqFilter,        setHqFilter]         = useState<string[]>([])
  const [momentumFilter,  setMomentumFilter]   = useState<string[]>([])
  const [foundedFilter,   setFoundedFilter]    = useState<string[]>([])
  const [investorFilter,  setInvestorFilter]   = useState<string[]>([])
  const [companySearch,   setCompanySearch]    = useState('')
  const [showFilters,     setShowFilters]      = useState(false)
  const [dbIndustries,    setDbIndustries]     = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Search mode
  const [searchMode, setSearchMode] = useState<SearchMode>('market')

  // Deal flow
  const [dealFlowMap,  setDealFlowMap]  = useState<Record<string, string>>({})

  // Scores + tracking
  const [scoresMap,    setScoresMap]    = useState<Record<string, number>>({})
  const [trackingMap,  setTrackingMap]  = useState<Record<string, 'viewed' | 'targeted'>>({})

  // Rename state: mapId -> editing name
  const [renamingId,    setRenamingId]    = useState<string | null>(null)
  const [renameValue,   setRenameValue]   = useState('')

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch:    () => { document.querySelector<HTMLInputElement>('input[placeholder*="sector"]')?.focus() },
    onClose:     () => { setSelectedCompany(null); setShowWatchlist(false); setShowExportMenu(false) },
    onWatchlist: () => setShowWatchlist(w => !w),
    onCompare:   () => setViewMode(v => v === 'compare' ? 'grid' : 'compare'),
    onHeatmap:   () => setViewMode(v => v === 'heatmap' ? 'grid' : 'heatmap'),
    onExport:    () => { if (currentMap) exportCSV(currentMap) },
  })

  // Auth check + load saved maps + watchlist + deal flow
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { navigate('/login'); return }
      setUserEmail(data.user.email ?? '')
    })
    fetchSavedMaps()
    fetchWatchlist()
    fetchDealFlow()
    fetchIndustries()
    fetchTracking()
    // Restore last map + scores instantly from cached data (no Supabase round trip)
    const cachedMap    = sessionStorage.getItem('terrain_last_map_data')
    const cachedId     = sessionStorage.getItem('terrain_last_map_id')
    const cachedScores = cachedId ? sessionStorage.getItem(`terrain_scores_${cachedId}`) : null
    if (cachedMap) {
      try {
        setCurrentMap(JSON.parse(cachedMap) as MarketMap)
        if (cachedId) setCurrentMapId(cachedId)
        if (cachedScores) setScoresMap(JSON.parse(cachedScores))
      } catch { /* ignore corrupt cache */ }
    } else if (cachedId) {
      loadSavedMap(cachedId)
    }
  }, [navigate])

  // Persist map data immediately whenever it changes (not waiting for Supabase)
  useEffect(() => {
    if (currentMap) {
      sessionStorage.setItem('terrain_last_map_data', JSON.stringify(currentMap))
    }
  }, [currentMap])

  // Persist scores to sessionStorage whenever they update
  useEffect(() => {
    if (currentMapId && Object.keys(scoresMap).length > 0) {
      sessionStorage.setItem(`terrain_scores_${currentMapId}`, JSON.stringify(scoresMap))
    }
  }, [scoresMap, currentMapId])

  // Rotate loading messages
  useEffect(() => {
    if (!isLoading) return
    const iv = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 1900)
    return () => clearInterval(iv)
  }, [isLoading])

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return
    function handler() { setShowExportMenu(false) }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [showExportMenu])

  async function fetchSavedMaps() {
    const { data } = await supabase
      .from('saved_maps')
      .select('id, query, created_at')
      .order('created_at', { ascending: false })
      .limit(6)
    if (data) setSavedMaps(data as SavedMap[])
  }

  async function fetchWatchlist() {
    const { data } = await supabase
      .from('watchlist')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setWatchlistItems(data as WatchlistItem[])
      setWatchlistIds(new Set(data.map((i: WatchlistItem) => i.company_id)))
    }
  }

  async function fetchDealFlow() {
    const { data } = await supabase
      .from('deal_flow')
      .select('company_id, status')
    if (data) {
      const map: Record<string, string> = {}
      for (const row of data as { company_id: string; status: string }[]) {
        map[row.company_id] = row.status
      }
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

  async function fetchIndustries() {
    const { data } = await supabase
      .from('clay_companies')
      .select('industry')
      .not('industry', 'is', null)
      .limit(5000)
    if (data) {
      const unique = Array.from(new Set(data.map((r: { industry: string }) => r.industry))).sort() as string[]
      setDbIndustries(unique)
    }
  }

  async function handleToggleWatchlist(company: Company) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (watchlistIds.has(company.id)) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('company_id', company.id)
      setWatchlistIds(prev => { const n = new Set(prev); n.delete(company.id); return n })
      setWatchlistItems(prev => prev.filter(i => i.company_id !== company.id))
    } else {
      await supabase.from('watchlist').insert({
        user_id: user.id,
        company_id: company.id,
        company_data: company,
        sector: currentMap?.sector ?? '',
      })
      fetchWatchlist()
    }
  }

  async function handleShare() {
    if (!currentMapId) return
    setShareStatus('sharing')
    await supabase.from('saved_maps').update({ is_public: true }).eq('id', currentMapId)
    const url = `${window.location.origin}/share/${currentMapId}`
    await navigator.clipboard.writeText(url)
    setShareStatus('copied')
    setTimeout(() => setShareStatus('idle'), 3000)
  }

  function extractCompanyFromUrl(input: string): { name: string; url: string } | null {
    try {
      const raw = input.trim()
      if (!raw.includes('.') && !raw.startsWith('http')) return null
      const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
      // LinkedIn company URL
      const liMatch = url.pathname.match(/\/company\/([^/?#]+)/)
      if (liMatch) {
        const slug = liMatch[1]
        const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        return { name, url: raw }
      }
      // General website — use primary domain
      const domain = url.hostname.replace(/^www\./, '').split('.')[0]
      const name = domain.charAt(0).toUpperCase() + domain.slice(1)
      return { name, url: raw }
    } catch {
      return null
    }
  }

  async function handleSearch(query: string) {
    setIsLoading(true)
    setError(null)
    setCurrentMap(null)
    setCurrentMapId(null)
    setScoresMap({})
    setActiveSegment(null)
    setStageFilter([])
    setHeadcountFilter([])
    setHqFilter([])
    setMomentumFilter([])
    setFoundedFilter([])
    setInvestorFilter([])
    setCompanySearch('')
    setShowFilters(false)
    setLoadingMsgIdx(0)
    setViewMode('grid')
    setChatInitialQ(undefined)
    // Clear all stale caches so segment pages reload fresh data for the new map
    sessionStorage.removeItem('terrain_last_map_data')
    sessionStorage.removeItem('terrain_last_map_id')
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('terrain_seg_')) sessionStorage.removeItem(key)
    }

    try {
      let map
      if (searchMode === 'company') {
        const urlResult = extractCompanyFromUrl(query)
        const companyName = urlResult?.name ?? query
        const urlHint     = urlResult?.url
        map = await analyzeCompanyLandscape(companyName, urlHint)
      } else {
        map = await generateMarketMap(query)
      }
      setCurrentMap(map)
      if (map.is_company_search) setViewMode('heatmap')

      // Score companies in background — capture mapId at call time to avoid stale closure
      const allCompanies = map.segments.flatMap(s => s.companies)
      const scoringMap = map
      scoreCompanies(allCompanies).then(scores => {
        // Only apply scores if the map hasn't changed since this request started
        setCurrentMap(m => {
          if (m === scoringMap) setScoresMap(scores)
          return m
        })
      })

      // Auto-save to Supabase
      const { data, error: saveErr } = await supabase
        .from('saved_maps')
        .insert({ query, map_data: map })
        .select('id')
        .single()

      if (!saveErr && data) {
        setCurrentMapId(data.id)
        sessionStorage.setItem('terrain_last_map_id', data.id)
        sessionStorage.setItem('terrain_last_map_data', JSON.stringify(map))
      }
      fetchSavedMaps()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate market map'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadSavedMap(id: string) {
    try {
      const { data, error } = await supabase
        .from('saved_maps')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !data) return
      setCurrentMap(data.map_data as MarketMap)
      setCurrentMapId(data.id)
      // Restore cached scores for this specific map
      const cachedScores = sessionStorage.getItem(`terrain_scores_${data.id}`)
      if (cachedScores) {
        try { setScoresMap(JSON.parse(cachedScores)) } catch { setScoresMap({}) }
      } else {
        setScoresMap({})
      }
      sessionStorage.setItem('terrain_last_map_id', data.id)
      sessionStorage.setItem('terrain_last_map_data', JSON.stringify(data.map_data))
      setActiveSegment(null)
      setError(null)
      setViewMode('grid')
      setChatInitialQ(undefined)
    } catch { /* silently ignore */ }
  }

  async function handleDeleteMap(mapId: string) {
    if (!window.confirm('Delete this saved map? This cannot be undone.')) return
    await supabase.from('saved_maps').delete().eq('id', mapId)
    setSavedMaps(prev => prev.filter(m => m.id !== mapId))
    sessionStorage.removeItem(`terrain_scores_${mapId}`)
    if (currentMapId === mapId) {
      setCurrentMap(null)
      setCurrentMapId(null)
      setScoresMap({})
      sessionStorage.removeItem('terrain_last_map_data')
      sessionStorage.removeItem('terrain_last_map_id')
    }
  }

  function startRename(map: SavedMap) {
    setRenamingId(map.id)
    setRenameValue(map.query)
  }

  async function commitRename(mapId: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingId(null); return }
    await supabase.from('saved_maps').update({ query: trimmed }).eq('id', mapId)
    setSavedMaps(prev => prev.map(m => m.id === mapId ? { ...m, query: trimmed } : m))
    setRenamingId(null)
  }

  function handleSetDealStatus(companyId: string, _companyName: string, status: string | null) {
    setDealFlowMap(prev => {
      const next = { ...prev }
      if (status === null) {
        delete next[companyId]
      } else {
        next[companyId] = status
      }
      return next
    })
  }

  async function handleToggleTracking(company: Company, status: 'viewed' | 'targeted') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const existing = trackingMap[company.id]
    if (existing === status) {
      await supabase.from('company_tracking').delete().eq('user_id', user.id).eq('company_id', company.id)
      setTrackingMap(prev => { const n = { ...prev }; delete n[company.id]; return n })
    } else {
      await supabase.from('company_tracking').upsert(
        { user_id: user.id, company_id: company.id, company_data: company, status, sector: currentMap?.sector ?? '', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,company_id' }
      )
      setTrackingMap(prev => ({ ...prev, [company.id]: status }))
    }
  }

  function handleAskAI(company: Company) {
    setChatInitialQ(`Tell me about ${company.name} — is it a promising investment?`)
    setShowChat(true)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }


  const visibleSegments = currentMap?.segments.filter(
    s => !activeSegment || s.id === activeSegment
  ) ?? []

  const hasMap = !!currentMap || viewMode === 'compare' || viewMode === 'pipeline'

  return (
    <div className="min-h-screen bg-terrain-bg text-terrain-text font-mono">
      {/* Subtle grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(#f0ede8 1px, transparent 1px), linear-gradient(90deg, #f0ede8 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Header */}
      <header className="relative border-b border-terrain-border bg-terrain-bg/90 backdrop-blur sticky top-0 z-20" style={{ boxShadow: '0 1px 20px rgba(201,168,76,0.06), 0 1px 0 rgba(201,168,76,0.08)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4 shrink-0">
            <h1 className="font-display text-xl font-bold text-terrain-text tracking-[0.3em] uppercase">
              Terrain
            </h1>
            <span className="text-terrain-muted text-[10px] uppercase tracking-widest hidden sm:block">
              Early-Stage Intelligence
            </span>
          </div>

          {/* View mode tabs — shown when there's content */}
          {hasMap && (
            <div className="flex items-center gap-1 bg-terrain-surface border border-terrain-border rounded px-1 py-1">
              {(['grid', 'heatmap', 'compare', 'pipeline'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                    viewMode === mode
                      ? 'bg-terrain-gold text-terrain-bg font-bold'
                      : 'text-terrain-muted hover:text-terrain-text'
                  }`}
                >
                  {mode === 'pipeline' ? 'Pipeline' : mode}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Daily Picks link */}
            <button
              onClick={() => navigate('/daily')}
              className="flex items-center gap-1.5 text-xs font-mono border border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder px-3 py-1.5 rounded transition-all duration-200"
            >
              <span>✦</span>
              <span className="hidden sm:inline">Daily Picks</span>
            </button>

            {/* Targeted page link */}
            <button
              onClick={() => navigate('/targeted')}
              className="flex items-center gap-1.5 text-xs font-mono border border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder px-3 py-1.5 rounded transition-all duration-200"
            >
              <span>⊙</span>
              <span className="hidden sm:inline">Targeted</span>
              {Object.values(trackingMap).filter(s => s === 'targeted').length > 0 && (
                <span className="text-terrain-gold font-bold">{Object.values(trackingMap).filter(s => s === 'targeted').length}</span>
              )}
            </button>

            {/* Pipeline — always visible */}
            <button
              onClick={() => setViewMode(v => v === 'pipeline' ? 'grid' : 'pipeline')}
              className={`flex items-center gap-1.5 text-xs font-mono border px-3 py-1.5 rounded transition-all duration-200 ${
                viewMode === 'pipeline'
                  ? 'border-terrain-gold text-terrain-gold'
                  : 'border-terrain-border text-terrain-muted hover:text-terrain-gold'
              }`}
            >
              <span>⬡</span>
              <span className="hidden sm:inline">Pipeline</span>
            </button>

            {/* Action buttons group — shown when there's a map */}
            {currentMap && (
              <div className="flex items-center border border-terrain-border rounded-lg overflow-hidden divide-x divide-terrain-border">
                {/* AI Guide */}
                <button
                  onClick={() => { setChatInitialQ(undefined); setShowChat(c => !c) }}
                  className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 transition-all duration-200 ${
                    showChat
                      ? 'bg-terrain-goldDim text-terrain-gold'
                      : 'text-terrain-muted hover:text-terrain-gold hover:bg-terrain-surface'
                  }`}
                >
                  <span>✦</span>
                  <span className="hidden sm:inline">AI Guide</span>
                </button>

                {/* Watchlist */}
                <button
                  onClick={() => setShowWatchlist(w => !w)}
                  className="flex items-center gap-1.5 text-terrain-muted hover:text-terrain-gold text-xs font-mono px-3 py-1.5 transition-all duration-200 hover:bg-terrain-surface"
                >
                  <span>♥</span>
                  <span className="hidden sm:inline">Watchlist</span>
                  {watchlistItems.length > 0 && (
                    <span className="text-terrain-gold font-bold">{watchlistItems.length}</span>
                  )}
                </button>

                {/* Share */}
                <button
                  onClick={handleShare}
                  disabled={!currentMapId || shareStatus !== 'idle'}
                  className="text-terrain-muted hover:text-terrain-gold text-xs font-mono px-3 py-1.5 transition-all duration-200 hover:bg-terrain-surface disabled:opacity-40"
                >
                  {shareStatus === 'sharing' ? '···' : shareStatus === 'copied' ? '✓ Copied!' : '↗ Share'}
                </button>

                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={e => { e.stopPropagation(); setShowExportMenu(m => !m) }}
                    className="text-terrain-muted hover:text-terrain-gold text-xs font-mono px-3 py-1.5 transition-all duration-200 hover:bg-terrain-surface"
                  >
                    ↓ Export ▾
                  </button>
                  {showExportMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 bg-terrain-surface border border-terrain-border rounded-lg shadow-xl z-30 min-w-[160px]"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { exportCSV(currentMap); setShowExportMenu(false) }}
                        className="w-full text-left px-4 py-2.5 text-xs font-mono text-terrain-muted hover:text-terrain-gold hover:bg-terrain-bg transition-colors"
                      >
                        Download CSV
                      </button>
                      <button
                        onClick={() => { printMap(); setShowExportMenu(false) }}
                        className="w-full text-left px-4 py-2.5 text-xs font-mono text-terrain-muted hover:text-terrain-gold hover:bg-terrain-bg transition-colors border-t border-terrain-border"
                      >
                        Print / PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {userEmail && (
              <span className="text-terrain-muted text-xs hidden md:block truncate max-w-[160px] ml-1">
                {userEmail}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-terrain-muted text-xs hover:text-terrain-text transition-colors tracking-wider ml-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-6 pb-20">

        {/* Compare mode takes full view */}
        {viewMode === 'compare' && (
          <CompareView onCompanyClick={setSelectedCompany} />
        )}

        {/* Pipeline view */}
        {viewMode === 'pipeline' && (
          <div>
            <div className="pt-8 pb-4">
              <h2 className="font-display text-3xl font-bold text-terrain-text">Deal Flow Pipeline</h2>
              <p className="text-terrain-muted text-sm font-mono mt-2">Drag companies between stages or use the move buttons.</p>
            </div>
            <DealFlowPipeline onCompanyClick={company => setSelectedCompany(company)} />
          </div>
        )}

        {viewMode !== 'compare' && viewMode !== 'pipeline' && (
          <>
            {/* Hero search area */}
            <div className={`${currentMap ? 'py-10' : 'py-24'} transition-all duration-300 relative`}>
              {!currentMap && !isLoading && (
                <>
                  {/* Decorative background hexagon */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                    <span className="text-[28rem] text-terrain-gold opacity-[0.025] leading-none">⬡</span>
                  </div>
                  <div className="text-center mb-12 relative">
                    <h2 className="font-display text-7xl font-bold text-terrain-text mb-4 tracking-tight" style={{ borderBottom: '1px solid rgba(201,168,76,0.2)', display: 'inline-block', paddingBottom: '0.5rem' }}>
                      TERRAIN
                    </h2>
                    <p className="text-terrain-gold text-sm font-mono mt-4 tracking-widest uppercase">
                      Early-stage deal intelligence. Pre-Seed · Seed · Series A.
                    </p>
                  </div>
                </>
              )}
              <SearchBar onSearch={handleSearch} isLoading={isLoading} industries={dbIndustries} searchMode={searchMode} onModeChange={setSearchMode} />
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-8">
                <div className="relative">
                  <div className="w-12 h-12 border border-terrain-border rounded-full" />
                  <div className="absolute inset-0 w-12 h-12 border-t border-terrain-gold rounded-full animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-terrain-muted text-sm font-mono tracking-wide">
                    {(searchMode === 'company' ? COMPANY_LOADING_MESSAGES : LOADING_MESSAGES)[loadingMsgIdx]}
                  </p>
                  <p className="text-terrain-subtle text-xs mt-2 font-mono">
                    This may take 10–15 seconds
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !isLoading && (
              <div className="max-w-2xl mx-auto mb-8 px-5 py-4 rounded border border-red-900/50 bg-red-950/30 text-red-400 text-sm font-mono">
                <span className="text-red-500 font-bold mr-2">Error:</span>{error}
              </div>
            )}

            {/* Market Map */}
            {currentMap && !isLoading && (
              <div className="mt-2">
                {/* Map header */}
                <div className="flex items-start justify-between gap-8 mb-8 pb-8 border-b border-terrain-border">
                  <div className="min-w-0">
                    <h2 className="font-display text-4xl font-bold text-terrain-text leading-tight">
                      {currentMap.sector}
                    </h2>
                    <p className="text-terrain-muted text-sm font-mono mt-3 max-w-2xl leading-relaxed">
                      {currentMap.summary}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-terrain-gold font-display text-2xl font-bold">
                      {currentMap.total_market_size}
                    </div>
                    <div className="text-terrain-muted text-xs font-mono mt-1">
                      {(() => {
                        try {
                          return new Date(currentMap.last_updated).toLocaleDateString('en-US', {
                            month: 'long', year: 'numeric',
                          })
                        } catch { return currentMap.last_updated }
                      })()}
                    </div>
                  </div>
                </div>

                {/* Funding chart — shown before segment filter tabs in grid view */}
                {viewMode === 'grid' && (
                  <FundingChart segments={currentMap.segments} />
                )}

                {/* Heatmap view */}
                {viewMode === 'heatmap' && (
                  <HeatmapView map={currentMap} onCompanyClick={setSelectedCompany} scoresMap={scoresMap} onScoresUpdate={scores => setScoresMap(s => ({ ...s, ...scores }))} />
                )}

                {/* Grid view */}
                {viewMode === 'grid' && (
                  <>
                    {/* Segment filter tabs */}
                    <div className="flex gap-2 mb-8 flex-wrap">
                      <button
                        onClick={() => setActiveSegment(null)}
                        className={`px-4 py-1.5 rounded text-[11px] font-mono tracking-widest uppercase transition-colors ${
                          !activeSegment
                            ? 'bg-terrain-gold text-terrain-bg font-bold'
                            : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                        }`}
                      >
                        All
                      </button>
                      {currentMap.segments.map(seg => (
                        <button
                          key={seg.id}
                          onClick={() => setActiveSegment(seg.id === activeSegment ? null : seg.id)}
                          className={`px-4 py-1.5 rounded text-[11px] font-mono tracking-widest uppercase transition-all ${
                            seg.id === activeSegment
                              ? 'font-bold text-terrain-bg'
                              : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                          }`}
                          style={seg.id === activeSegment ? { backgroundColor: seg.color } : {}}
                        >
                          {seg.name}
                        </button>
                      ))}
                    </div>

                    {/* Compact filter bar */}
                    {(() => {
                      const activeFilterCount = [stageFilter, headcountFilter, hqFilter, momentumFilter, foundedFilter, investorFilter].reduce((n, f) => n + f.length, 0) + (companySearch ? 1 : 0)

                      const stages = Array.from(new Set(currentMap.segments.flatMap(s => s.companies.map(c => c.stage)))).filter(Boolean)
                      const STAGE_ORDER = ['Pre-Seed','Seed','Series A','Series B','Series C','Series D+','Public','Bootstrapped','Acquired']
                      stages.sort((a, b) => { const ai = STAGE_ORDER.indexOf(a), bi = STAGE_ORDER.indexOf(b); return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) })

                      const HEADCOUNT_ORDER = ['1-10','11-50','51-200','201-500','501-1000','1000+']
                      const ranges = Array.from(new Set(currentMap.segments.flatMap(s => s.companies.map(c => c.headcount_range)))).filter(Boolean)
                      ranges.sort((a, b) => { const ai = HEADCOUNT_ORDER.indexOf(a), bi = HEADCOUNT_ORDER.indexOf(b); return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) })

                      const RANGES_DEF = [
                        { label: 'Before 2000', test: (y: number) => y < 2000 },
                        { label: '2000–2009',   test: (y: number) => y >= 2000 && y <= 2009 },
                        { label: '2010–2014',   test: (y: number) => y >= 2010 && y <= 2014 },
                        { label: '2015–2019',   test: (y: number) => y >= 2015 && y <= 2019 },
                        { label: '2020–2022',   test: (y: number) => y >= 2020 && y <= 2022 },
                        { label: '2023+',       test: (y: number) => y >= 2023 },
                      ]
                      const years = currentMap.segments.flatMap(s => s.companies.map(c => c.founded)).filter(Boolean)
                      const presentRanges = RANGES_DEF.filter(r => years.some(y => r.test(y)))

                      const MOMENTUM_ORDER = ['🚀 Hypergrowth','📈 Growing','➡️ Stable','⚠️ Challenged','🔒 Stealth']
                      const signals = Array.from(new Set(currentMap.segments.flatMap(s => s.companies.map(c => c.momentum_signal)))).filter(Boolean)
                      signals.sort((a, b) => MOMENTUM_ORDER.indexOf(a) - MOMENTUM_ORDER.indexOf(b))

                      const locations = Array.from(new Set(currentMap.segments.flatMap(s => s.companies.map(c => c.hq)))).filter(Boolean).sort()
                      const investors = Array.from(new Set(currentMap.segments.flatMap(s => s.companies.flatMap(c => c.investors ?? [])))).filter(Boolean).sort()

                      return (
                        <div className="mb-8">
                          {/* Single-row filter bar */}
                          <div className="flex items-center gap-3 mb-3">
                            <input
                              type="text"
                              value={companySearch}
                              onChange={e => setCompanySearch(e.target.value)}
                              placeholder="Filter companies…"
                              className="flex-1 max-w-xs bg-terrain-bg border border-terrain-border rounded px-4 py-2 text-terrain-text text-xs font-mono focus:outline-none focus:border-terrain-gold transition-all duration-200 placeholder-terrain-muted"
                            />
                            <button
                              onClick={() => setShowFilters(f => !f)}
                              className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-all duration-200 ${
                                showFilters || activeFilterCount > 0
                                  ? 'border-terrain-goldBorder bg-terrain-goldDim text-terrain-gold'
                                  : 'border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder'
                              }`}
                            >
                              <span>≡</span>
                              <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
                            </button>
                            {activeFilterCount > 0 && (
                              <button
                                onClick={() => {
                                  setStageFilter([]); setHeadcountFilter([]); setHqFilter([])
                                  setMomentumFilter([]); setFoundedFilter([]); setInvestorFilter([]); setCompanySearch('')
                                }}
                                className="text-terrain-muted text-xs font-mono hover:text-terrain-gold transition-colors underline underline-offset-2"
                              >
                                Clear all
                              </button>
                            )}
                          </div>

                          {/* Collapsible filter panel */}
                          {showFilters && (
                            <div className="bg-terrain-surface border border-terrain-border rounded-lg p-4 space-y-4">
                              {/* Stage */}
                              {stages.length > 0 && (
                                <div className="flex gap-2 flex-wrap items-center">
                                  <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono w-16 shrink-0">Stage</span>
                                  <button onClick={() => setStageFilter([])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${stageFilter.length === 0 ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>All</button>
                                  <button onClick={() => setStageFilter(f => f.includes('Early Stage') ? f.filter(x => x !== 'Early Stage') : [...f, 'Early Stage'])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${stageFilter.includes('Early Stage') ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-gold/70 hover:text-terrain-gold border border-terrain-goldBorder/40'}`}>⬡ Early Stage</button>
                                  {stages.map(stage => (
                                    <button key={stage} onClick={() => setStageFilter(f => f.includes(stage) ? f.filter(x => x !== stage) : [...f, stage])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${stageFilter.includes(stage) ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>{stage}</button>
                                  ))}
                                </div>
                              )}
                              {/* Headcount */}
                              {ranges.length > 0 && (
                                <div className="flex gap-2 flex-wrap items-center">
                                  <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono w-16 shrink-0">Size</span>
                                  <button onClick={() => setHeadcountFilter([])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${headcountFilter.length === 0 ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>All</button>
                                  {ranges.map(range => (
                                    <button key={range} onClick={() => setHeadcountFilter(f => f.includes(range) ? f.filter(x => x !== range) : [...f, range])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${headcountFilter.includes(range) ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>{range}</button>
                                  ))}
                                </div>
                              )}
                              {/* Founded */}
                              {presentRanges.length > 0 && (
                                <div className="flex gap-2 flex-wrap items-center">
                                  <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono w-16 shrink-0">Founded</span>
                                  <button onClick={() => setFoundedFilter([])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${foundedFilter.length === 0 ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>All</button>
                                  {presentRanges.map(r => (
                                    <button key={r.label} onClick={() => setFoundedFilter(f => f.includes(r.label) ? f.filter(x => x !== r.label) : [...f, r.label])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${foundedFilter.includes(r.label) ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>{r.label}</button>
                                  ))}
                                </div>
                              )}
                              {/* Momentum */}
                              {signals.length > 0 && (
                                <div className="flex gap-2 flex-wrap items-center">
                                  <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono w-16 shrink-0">Signal</span>
                                  <button onClick={() => setMomentumFilter([])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${momentumFilter.length === 0 ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>All</button>
                                  {signals.map(signal => (
                                    <button key={signal} onClick={() => setMomentumFilter(f => f.includes(signal) ? f.filter(x => x !== signal) : [...f, signal])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest transition-colors ${momentumFilter.includes(signal) ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>{signal}</button>
                                  ))}
                                </div>
                              )}
                              {/* HQ */}
                              {locations.length > 0 && (
                                <div className="flex gap-2 flex-wrap items-center">
                                  <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono w-16 shrink-0">HQ</span>
                                  <button onClick={() => setHqFilter([])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${hqFilter.length === 0 ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>All</button>
                                  {locations.map(loc => (
                                    <button key={loc} onClick={() => setHqFilter(f => f.includes(loc) ? f.filter(x => x !== loc) : [...f, loc])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${hqFilter.includes(loc) ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>{loc}</button>
                                  ))}
                                </div>
                              )}
                              {/* Investor */}
                              {investors.length > 0 && (
                                <div className="flex gap-2 flex-wrap items-center">
                                  <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono w-16 shrink-0">Investor</span>
                                  <button onClick={() => setInvestorFilter([])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${investorFilter.length === 0 ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>All</button>
                                  {investors.map(inv => (
                                    <button key={inv} onClick={() => setInvestorFilter(f => f.includes(inv) ? f.filter(x => x !== inv) : [...f, inv])} className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest transition-colors ${investorFilter.includes(inv) ? 'bg-terrain-gold text-terrain-bg font-bold' : 'bg-terrain-bg text-terrain-muted hover:text-terrain-text border border-terrain-border'}`}>{inv}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Empty DB state */}
                    {currentMap.segments.every(s => s.companies.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="text-terrain-muted text-4xl mb-4">⬡</div>
                        <p className="text-terrain-muted text-sm font-mono">No companies found in the database for this query.</p>
                        <p className="text-terrain-subtle text-xs font-mono mt-2">Try a different sector or industry keyword.</p>
                      </div>
                    )}

                    {/* Segments */}
                    {visibleSegments.map(segment => (
                      <SegmentRow
                        key={segment.id}
                        segment={segment}
                        sector={currentMap.sector}
                        onCompanyClick={setSelectedCompany}
                        watchlistIds={watchlistIds}
                        onToggleWatchlist={handleToggleWatchlist}
                        stageFilter={stageFilter}
                        headcountFilter={headcountFilter}
                        hqFilter={hqFilter}
                        momentumFilter={momentumFilter}
                        foundedFilter={foundedFilter}
                        investorFilter={investorFilter}
                        companySearch={companySearch}
                        dealFlowMap={dealFlowMap}
                        onAskAI={handleAskAI}
                        scoresMap={scoresMap}
                        trackingMap={trackingMap}
                      />
                    ))}
                  </>
                )}

                {/* White spaces + Key trends (grid and heatmap) */}
                {viewMode !== 'heatmap' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                    <WhiteSpaces spaces={currentMap.white_spaces} />
                    <KeyTrends   trends={currentMap.key_trends} />
                  </div>
                )}

                {viewMode === 'heatmap' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
                    <WhiteSpaces spaces={currentMap.white_spaces} />
                    <KeyTrends   trends={currentMap.key_trends} />
                  </div>
                )}

                {/* Notable Exits */}
                {currentMap.notable_exits?.length > 0 && (
                  <div className="mt-5 bg-terrain-surface border border-terrain-border rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-terrain-gold text-lg">⬡</span>
                      <h3 className="font-display text-base font-semibold text-terrain-text">
                        Notable Exits
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {currentMap.notable_exits.map((exit, i) => (
                        <div key={i} className="border border-terrain-border rounded p-4 bg-terrain-bg">
                          <div className="font-display font-semibold text-terrain-text">{exit.company}</div>
                          <div className="text-terrain-muted text-xs font-mono mt-1">
                            {exit.acquirer_or_ipo} · {exit.year}
                          </div>
                          <div className="text-terrain-gold text-sm font-bold font-mono mt-2">
                            {exit.value_display}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data sources */}
                {currentMap.data_sources?.length > 0 && (
                  <div className="mt-5 text-terrain-subtle text-[11px] font-mono">
                    Sources: {currentMap.data_sources.join(' · ')}
                  </div>
                )}
              </div>
            )}

            {/* Recent saved maps (shown when no current map) */}
            {!currentMap && !isLoading && savedMaps.length > 0 && (
              <div className="max-w-2xl mx-auto mt-4">
                <div className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono mb-4">
                  Recent Maps
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedMaps.map(map => (
                    <div
                      key={map.id}
                      className="relative group px-5 py-4 bg-terrain-surface border border-terrain-border rounded-lg hover:border-terrain-goldBorder transition-all duration-200"
                      style={{ borderLeft: '2px solid rgba(201,168,76,0.15)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderLeft = '2px solid rgba(201,168,76,0.7)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderLeft = '2px solid rgba(201,168,76,0.15)' }}
                    >
                      {/* Main clickable area */}
                      <button
                        onClick={() => loadSavedMap(map.id)}
                        className="w-full text-left flex items-start gap-3"
                      >
                        {/* Sector initial badge */}
                        <div className="shrink-0 w-8 h-8 rounded bg-terrain-goldDim border border-terrain-goldBorder flex items-center justify-center text-terrain-gold text-sm font-display font-bold">
                          {map.query.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          {renamingId === map.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => commitRename(map.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); commitRename(map.id) }
                                if (e.key === 'Escape') { setRenamingId(null) }
                              }}
                              onClick={e => e.stopPropagation()}
                              className="w-full bg-terrain-bg border border-terrain-gold rounded px-2 py-0.5 text-terrain-text text-sm font-mono focus:outline-none"
                            />
                          ) : (
                            <div className="text-terrain-text text-sm font-mono group-hover:text-terrain-gold transition-colors truncate pr-10">
                              {map.query}
                            </div>
                          )}
                          <div className="text-terrain-muted text-[10px] font-mono mt-1 opacity-60">
                            {new Date(map.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </div>
                        </div>
                      </button>

                      {/* Action buttons */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Rename */}
                        <button
                          onClick={e => { e.stopPropagation(); startRename(map) }}
                          title="Rename"
                          className="text-terrain-muted hover:text-terrain-gold text-sm leading-none px-1 py-0.5 transition-colors"
                        >
                          ✎
                        </button>
                        {/* Delete */}
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteMap(map.id) }}
                          title="Delete"
                          className="text-terrain-muted hover:text-red-400 text-base leading-none px-1 py-0.5 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Company detail modal */}
      {selectedCompany && (
        <CompanyModal
          company={selectedCompany}
          mapId={currentMapId}
          onClose={() => setSelectedCompany(null)}
          isWatchlisted={watchlistIds.has(selectedCompany.id)}
          onToggleWatchlist={handleToggleWatchlist}
          dealStatus={dealFlowMap[selectedCompany.id]}
          onSetDealStatus={handleSetDealStatus}
          sector={currentMap?.sector}
          score={scoresMap[selectedCompany.id]}
          trackingStatus={trackingMap[selectedCompany.id]}
          onToggleTracking={handleToggleTracking}
        />
      )}

      {/* Watchlist panel */}
      {showWatchlist && (
        <WatchlistPanel
          items={watchlistItems}
          onCompanyClick={company => { setSelectedCompany(company); setShowWatchlist(false) }}
          onRemove={companyId => {
            setWatchlistIds(prev => { const n = new Set(prev); n.delete(companyId); return n })
            setWatchlistItems(prev => prev.filter(i => i.company_id !== companyId))
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user) supabase.from('watchlist').delete().eq('user_id', user.id).eq('company_id', companyId)
            })
          }}
          onClose={() => setShowWatchlist(false)}
        />
      )}

      {/* AI Guide chat panel */}
      {showChat && currentMap && (
        <MapChat
          map={currentMap}
          onClose={() => { setShowChat(false); setChatInitialQ(undefined) }}
          initialQuestion={chatInitialQ}
        />
      )}

      {/* Hidden ref for search focus */}
      <input ref={searchInputRef} className="sr-only" aria-hidden="true" tabIndex={-1} readOnly />
    </div>
  )
}
