import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateMarketMap, fetchMoreCompanies } from '../lib/claudeApi'
import { MarketMap, Company, SavedMap } from '../types/marketMap'
import SearchBar    from '../components/SearchBar'
import SegmentRow   from '../components/SegmentRow'
import WhiteSpaces  from '../components/WhiteSpaces'
import KeyTrends    from '../components/KeyTrends'
import CompanyModal from '../components/CompanyModal'
import CompareView  from '../components/CompareView'
import HeatmapView  from '../components/HeatmapView'
import WatchlistPanel, { WatchlistItem } from '../components/WatchlistPanel'
import MapChat from '../components/MapChat'
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

type ViewMode = 'grid' | 'heatmap' | 'compare'

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
  const [loadingMoreSegment, setLoadingMoreSegment] = useState<string | null>(null)
  const [loadMoreErrors,     setLoadMoreErrors]     = useState<Record<string, string>>({})
  const [stageFilter,     setStageFilter]      = useState<string | null>(null)
  const [headcountFilter, setHeadcountFilter]  = useState<string | null>(null)
  const [hqFilter,        setHqFilter]         = useState<string | null>(null)
  const [momentumFilter,  setMomentumFilter]   = useState<string | null>(null)
  const [foundedFilter,   setFoundedFilter]    = useState<string | null>(null)
  const [investorFilter,  setInvestorFilter]   = useState<string | null>(null)
  const [companySearch,   setCompanySearch]    = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch:    () => { document.querySelector<HTMLInputElement>('input[placeholder*="sector"]')?.focus() },
    onClose:     () => { setSelectedCompany(null); setShowWatchlist(false); setShowExportMenu(false) },
    onWatchlist: () => setShowWatchlist(w => !w),
    onCompare:   () => setViewMode(v => v === 'compare' ? 'grid' : 'compare'),
    onHeatmap:   () => setViewMode(v => v === 'heatmap' ? 'grid' : 'heatmap'),
    onExport:    () => { if (currentMap) exportCSV(currentMap) },
  })

  // Auth check + load saved maps + watchlist
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { navigate('/login'); return }
      setUserEmail(data.user.email ?? '')
    })
    fetchSavedMaps()
    fetchWatchlist()
  }, [navigate])

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

  async function handleSearch(query: string) {
    setIsLoading(true)
    setError(null)
    setCurrentMap(null)
    setCurrentMapId(null)
    setActiveSegment(null)
    setStageFilter(null)
    setHeadcountFilter(null)
    setHqFilter(null)
    setMomentumFilter(null)
    setFoundedFilter(null)
    setInvestorFilter(null)
    setCompanySearch('')
    setLoadingMsgIdx(0)
    setViewMode('grid')

    try {
      const map = await generateMarketMap(query)
      setCurrentMap(map)

      // Auto-save to Supabase
      const { data, error: saveErr } = await supabase
        .from('saved_maps')
        .insert({ query, map_data: map })
        .select('id')
        .single()

      if (!saveErr && data) setCurrentMapId(data.id)
      fetchSavedMaps()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate market map'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadSavedMap(id: string) {
    const { data } = await supabase
      .from('saved_maps')
      .select('*')
      .eq('id', id)
      .single()
    if (data) {
      setCurrentMap(data.map_data as MarketMap)
      setCurrentMapId(data.id)
      setActiveSegment(null)
      setError(null)
      setViewMode('grid')
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleLoadMore(segmentId: string) {
    if (!currentMap) return
    const segment = currentMap.segments.find(s => s.id === segmentId)
    if (!segment) return
    setLoadingMoreSegment(segmentId)
    try {
      const newCompanies = await fetchMoreCompanies(
        currentMap.sector,
        segment.name,
        segment.description,
        segment.companies.map(c => c.name)
      )
      setLoadMoreErrors(prev => { const n = { ...prev }; delete n[segmentId]; return n })
      setCurrentMap(prev => {
        if (!prev) return prev
        return {
          ...prev,
          segments: prev.segments.map(s =>
            s.id === segmentId
              ? { ...s, companies: [...s.companies, ...newCompanies] }
              : s
          ),
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load more companies'
      setLoadMoreErrors(prev => ({ ...prev, [segmentId]: msg }))
    } finally {
      setLoadingMoreSegment(null)
    }
  }

  const visibleSegments = currentMap?.segments.filter(
    s => !activeSegment || s.id === activeSegment
  ) ?? []

  const hasMap = !!currentMap || viewMode === 'compare'

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
      <header className="relative border-b border-terrain-border bg-terrain-bg/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4 shrink-0">
            <h1 className="font-display text-xl font-bold text-terrain-text tracking-[0.2em]">
              TERRAIN
            </h1>
            <span className="text-terrain-muted text-[10px] uppercase tracking-widest hidden sm:block">
              Market Intelligence
            </span>
          </div>

          {/* View mode tabs — shown when there's content */}
          {hasMap && (
            <div className="flex items-center gap-1 bg-terrain-surface border border-terrain-border rounded px-1 py-1">
              {(['grid', 'heatmap', 'compare'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                    viewMode === mode
                      ? 'bg-terrain-gold text-terrain-bg font-bold'
                      : 'text-terrain-muted hover:text-terrain-text'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Action buttons — shown when there's a map */}
            {currentMap && (
              <>
                {/* AI Guide */}
                <button
                  onClick={() => setShowChat(c => !c)}
                  className={`flex items-center gap-1.5 text-xs font-mono border px-3 py-1.5 rounded transition-colors ${
                    showChat
                      ? 'border-terrain-gold text-terrain-gold'
                      : 'border-terrain-border text-terrain-muted hover:text-terrain-gold'
                  }`}
                >
                  <span>✦</span>
                  <span className="hidden sm:inline">AI Guide</span>
                </button>

                {/* Watchlist */}
                <button
                  onClick={() => setShowWatchlist(w => !w)}
                  className="flex items-center gap-1.5 text-terrain-muted hover:text-terrain-gold text-xs font-mono border border-terrain-border px-3 py-1.5 rounded transition-colors"
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
                  className="text-terrain-muted hover:text-terrain-gold text-xs font-mono border border-terrain-border px-3 py-1.5 rounded transition-colors disabled:opacity-40"
                >
                  {shareStatus === 'sharing' ? '···' : shareStatus === 'copied' ? '✓ Copied!' : '↗ Share'}
                </button>

                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={e => { e.stopPropagation(); setShowExportMenu(m => !m) }}
                    className="text-terrain-muted hover:text-terrain-gold text-xs font-mono border border-terrain-border px-3 py-1.5 rounded transition-colors"
                  >
                    ↓ Export ▾
                  </button>
                  {showExportMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 bg-terrain-surface border border-terrain-border rounded shadow-xl z-30 min-w-[160px]"
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
              </>
            )}

            {userEmail && (
              <span className="text-terrain-muted text-xs hidden md:block truncate max-w-[160px]">
                {userEmail}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-terrain-muted text-xs hover:text-terrain-text transition-colors tracking-wider"
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

        {viewMode !== 'compare' && (
          <>
            {/* Hero search area */}
            <div className={`${currentMap ? 'py-10' : 'py-20'} transition-all`}>
              {!currentMap && !isLoading && (
                <div className="text-center mb-12">
                  <h2 className="font-display text-5xl font-bold text-terrain-text mb-3">
                    Map the market.
                  </h2>
                  <p className="text-terrain-muted text-sm max-w-md mx-auto leading-relaxed">
                    Enter a sector or company. TERRAIN returns a live competitive landscape —
                    segments, funding, white spaces, and momentum.
                  </p>
                </div>
              )}
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
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
                    {LOADING_MESSAGES[loadingMsgIdx]}
                  </p>
                  <p className="text-terrain-subtle text-xs mt-2 font-mono">
                    This may take 30–60 seconds
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

                {/* Heatmap view */}
                {viewMode === 'heatmap' && (
                  <HeatmapView map={currentMap} onCompanyClick={setSelectedCompany} />
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

                    {/* Company text search */}
                    <div className="mb-5">
                      <input
                        type="text"
                        value={companySearch}
                        onChange={e => setCompanySearch(e.target.value)}
                        placeholder="Filter companies…"
                        className="w-full max-w-xs bg-terrain-bg border border-terrain-border rounded px-4 py-2 text-terrain-text text-xs font-mono focus:outline-none focus:border-terrain-gold transition-colors placeholder-terrain-muted"
                      />
                    </div>

                    {/* Stage filter */}
                    {(() => {
                      const stages = Array.from(new Set(
                        currentMap.segments.flatMap(s => s.companies.map(c => c.stage))
                      )).filter(Boolean)
                      const STAGE_ORDER = ['Pre-Seed','Seed','Series A','Series B','Series C','Series D+','Public','Bootstrapped','Acquired']
                      stages.sort((a, b) => {
                        const ai = STAGE_ORDER.indexOf(a), bi = STAGE_ORDER.indexOf(b)
                        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                      })
                      if (stages.length === 0) return null
                      return (
                        <div className="flex gap-2 mb-8 flex-wrap items-center">
                          <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">Stage:</span>
                          <button
                            onClick={() => setStageFilter(null)}
                            className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                              !stageFilter
                                ? 'bg-terrain-gold text-terrain-bg font-bold'
                                : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                            }`}
                          >
                            All
                          </button>
                          {stages.map(stage => (
                            <button
                              key={stage}
                              onClick={() => setStageFilter(stageFilter === stage ? null : stage)}
                              className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                                stageFilter === stage
                                  ? 'bg-terrain-gold text-terrain-bg font-bold'
                                  : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                              }`}
                            >
                              {stage}
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Headcount filter */}
                    {(() => {
                      const HEADCOUNT_ORDER = ['1-10','11-50','51-200','201-500','501-1000','1000+']
                      const ranges = Array.from(new Set(
                        currentMap.segments.flatMap(s => s.companies.map(c => c.headcount_range))
                      )).filter(Boolean)
                      ranges.sort((a, b) => {
                        const ai = HEADCOUNT_ORDER.indexOf(a), bi = HEADCOUNT_ORDER.indexOf(b)
                        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                      })
                      if (ranges.length === 0) return null
                      return (
                        <div className="flex gap-2 mb-8 flex-wrap items-center">
                          <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">Headcount:</span>
                          <button
                            onClick={() => setHeadcountFilter(null)}
                            className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                              !headcountFilter
                                ? 'bg-terrain-gold text-terrain-bg font-bold'
                                : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                            }`}
                          >
                            All
                          </button>
                          {ranges.map(range => (
                            <button
                              key={range}
                              onClick={() => setHeadcountFilter(headcountFilter === range ? null : range)}
                              className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                                headcountFilter === range
                                  ? 'bg-terrain-gold text-terrain-bg font-bold'
                                  : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                              }`}
                            >
                              {range}
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Founded year filter */}
                    {(() => {
                      const RANGES = [
                        { label: 'Before 2000', test: (y: number) => y < 2000 },
                        { label: '2000–2009',   test: (y: number) => y >= 2000 && y <= 2009 },
                        { label: '2010–2014',   test: (y: number) => y >= 2010 && y <= 2014 },
                        { label: '2015–2019',   test: (y: number) => y >= 2015 && y <= 2019 },
                        { label: '2020–2022',   test: (y: number) => y >= 2020 && y <= 2022 },
                        { label: '2023+',       test: (y: number) => y >= 2023 },
                      ]
                      const years = currentMap.segments.flatMap(s => s.companies.map(c => c.founded)).filter(Boolean)
                      const presentRanges = RANGES.filter(r => years.some(y => r.test(y)))
                      if (presentRanges.length === 0) return null
                      return (
                        <div className="flex gap-2 mb-8 flex-wrap items-center">
                          <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">Founded:</span>
                          <button
                            onClick={() => setFoundedFilter(null)}
                            className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                              !foundedFilter
                                ? 'bg-terrain-gold text-terrain-bg font-bold'
                                : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                            }`}
                          >
                            All
                          </button>
                          {presentRanges.map(r => (
                            <button
                              key={r.label}
                              onClick={() => setFoundedFilter(foundedFilter === r.label ? null : r.label)}
                              className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                                foundedFilter === r.label
                                  ? 'bg-terrain-gold text-terrain-bg font-bold'
                                  : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Momentum filter */}
                    {(() => {
                      const MOMENTUM_ORDER = ['🚀 Hypergrowth','📈 Growing','➡️ Stable','⚠️ Challenged','🔒 Stealth']
                      const signals = Array.from(new Set(
                        currentMap.segments.flatMap(s => s.companies.map(c => c.momentum_signal))
                      )).filter(Boolean)
                      signals.sort((a, b) => MOMENTUM_ORDER.indexOf(a) - MOMENTUM_ORDER.indexOf(b))
                      if (signals.length === 0) return null
                      return (
                        <div className="flex gap-2 mb-8 flex-wrap items-center">
                          <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">Momentum:</span>
                          <button
                            onClick={() => setMomentumFilter(null)}
                            className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                              !momentumFilter
                                ? 'bg-terrain-gold text-terrain-bg font-bold'
                                : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                            }`}
                          >
                            All
                          </button>
                          {signals.map(signal => (
                            <button
                              key={signal}
                              onClick={() => setMomentumFilter(momentumFilter === signal ? null : signal)}
                              className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest transition-colors ${
                                momentumFilter === signal
                                  ? 'bg-terrain-gold text-terrain-bg font-bold'
                                  : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                              }`}
                            >
                              {signal}
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {/* HQ filter */}
                    {(() => {
                      const locations = Array.from(new Set(
                        currentMap.segments.flatMap(s => s.companies.map(c => c.hq))
                      )).filter(Boolean).sort()
                      if (locations.length === 0) return null
                      return (
                        <div className="flex gap-2 mb-8 flex-wrap items-center">
                          <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">HQ:</span>
                          <button
                            onClick={() => setHqFilter(null)}
                            className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                              !hqFilter
                                ? 'bg-terrain-gold text-terrain-bg font-bold'
                                : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                            }`}
                          >
                            All
                          </button>
                          {locations.map(loc => (
                            <button
                              key={loc}
                              onClick={() => setHqFilter(hqFilter === loc ? null : loc)}
                              className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                                hqFilter === loc
                                  ? 'bg-terrain-gold text-terrain-bg font-bold'
                                  : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                              }`}
                            >
                              {loc}
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Investor filter */}
                    {(() => {
                      const investors = Array.from(new Set(
                        currentMap.segments.flatMap(s => s.companies.flatMap(c => c.investors ?? []))
                      )).filter(Boolean).sort()
                      if (investors.length === 0) return null
                      return (
                        <div className="flex gap-2 mb-8 flex-wrap items-center">
                          <span className="text-terrain-muted text-[10px] uppercase tracking-widest font-mono">Investor:</span>
                          <button
                            onClick={() => setInvestorFilter(null)}
                            className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-colors ${
                              !investorFilter
                                ? 'bg-terrain-gold text-terrain-bg font-bold'
                                : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                            }`}
                          >
                            All
                          </button>
                          {investors.map(inv => (
                            <button
                              key={inv}
                              onClick={() => setInvestorFilter(investorFilter === inv ? null : inv)}
                              className={`px-3 py-1 rounded text-[10px] font-mono tracking-widest transition-colors ${
                                investorFilter === inv
                                  ? 'bg-terrain-gold text-terrain-bg font-bold'
                                  : 'bg-terrain-surface text-terrain-muted hover:text-terrain-text border border-terrain-border'
                              }`}
                            >
                              {inv}
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Segments */}
                    {visibleSegments.map(segment => (
                      <SegmentRow
                        key={segment.id}
                        segment={segment}
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
                        onLoadMore={() => handleLoadMore(segment.id)}
                        isLoadingMore={loadingMoreSegment === segment.id}
                        loadMoreError={loadMoreErrors[segment.id]}
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
                    <button
                      key={map.id}
                      onClick={() => loadSavedMap(map.id)}
                      className="text-left px-5 py-4 bg-terrain-surface border border-terrain-border rounded-lg hover:border-terrain-subtle transition-colors group"
                    >
                      <div className="text-terrain-text text-sm font-mono group-hover:text-terrain-gold transition-colors truncate">
                        {map.query}
                      </div>
                      <div className="text-terrain-muted text-xs font-mono mt-1.5">
                        {new Date(map.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </div>
                    </button>
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
        <MapChat map={currentMap} onClose={() => setShowChat(false)} />
      )}

      {/* Hidden ref for search focus */}
      <input ref={searchInputRef} className="sr-only" aria-hidden="true" tabIndex={-1} readOnly />
    </div>
  )
}
