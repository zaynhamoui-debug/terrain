import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  RecCompany,
  FeedbackEntry,
  getTodayRecs,
  generateTodayRecs,
  submitFeedback,
  getFeedbackMap,
} from '../lib/dailyRecs'
import {
  getTodayPicksFromDB,
  getLatestPipelineCandidates,
  submitPickFeedback,
  submitCandidateFeedback,
  getUserFeedbackMap,
  getPipelineFeedbackMap,
  getTotalFeedbackCount,
  formatRaised,
  type PickCompany,
  type PickFeedbackLabel,
} from '../lib/prospectingPicks'
import RecCompanyCard from '../components/RecCompanyCard'
import PickCard from '../components/PickCard'
import CompanyDrawer from '../components/CompanyDrawer'

const LOADING_MESSAGES = [
  'Scouting the web for startups…',
  'Screening against Mucker criteria…',
  'Verifying websites and traction…',
  'Analysing funding stage…',
  'Checking competitive dynamics…',
  'Validating market signals…',
  'Finalising top picks…',
]

type SortKey = 'rank' | 'mqs' | 'mus' | 'fit'
type View    = 'picks' | 'pipeline'

function sortPicks(picks: PickCompany[], key: SortKey, dir: 'asc' | 'desc'): PickCompany[] {
  return [...picks].sort((a, b) => {
    const av = key === 'rank' ? a.rank : key === 'mqs' ? a.score.mqs : key === 'mus' ? a.score.mus : a.score.combinedScore
    const bv = key === 'rank' ? b.rank : key === 'mqs' ? b.score.mqs : key === 'mus' ? b.score.mus : b.score.combinedScore
    return dir === 'asc' ? av - bv : bv - av
  })
}

export default function DailyPicks() {
  const navigate = useNavigate()
  const [userId,    setUserId]    = useState<string | null>(null)

  // Pre-computed Harmonic picks (primary)
  const [picks,         setPicks]         = useState<PickCompany[] | null>(null)
  const [pickFeedback,  setPickFeedback]  = useState<Record<string, PickFeedbackLabel>>({})
  const [totalFeedback, setTotalFeedback] = useState(0)
  const [recalibToast,  setRecalibToast]  = useState(false)

  // Pipeline (all candidates)
  const [pipeline,           setPipeline]           = useState<PickCompany[] | null>(null)
  const [pipelineLoading,    setPipelineLoading]    = useState(false)
  const [pipelineFeedback,   setPipelineFeedback]   = useState<Record<string, PickFeedbackLabel>>({})

  // On-demand Claude picks (fallback)
  const [companies, setCompanies] = useState<RecCompany[]>([])
  const [feedback,  setFeedback]  = useState<Record<string, FeedbackEntry>>({})

  // View / sort state
  const [view,    setView]    = useState<View>('picks')
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Detail drawer
  const [selected, setSelected] = useState<PickCompany | null>(null)

  const [source,  setSource]  = useState<'harmonic' | 'claude' | null>(null)
  const [loading, setLoading] = useState(true)
  const [msgIdx,  setMsgIdx]  = useState(0)
  const [error,   setError]   = useState<string | null>(null)
  const [isRegen, setIsRegen] = useState(false)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  useEffect(() => {
    if (!loading && !isRegen) return
    const id = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 2200)
    return () => clearInterval(id)
  }, [loading, isRegen])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { navigate('/login'); return }
      const uid = data.user.id
      setUserId(uid)

      try {
        const [dbPicks, allFeedback, totalCount] = await Promise.all([
          getTodayPicksFromDB(),
          getUserFeedbackMap(uid),
          getTotalFeedbackCount(uid),
        ])
        setPickFeedback(allFeedback)
        setTotalFeedback(totalCount)

        if (dbPicks && dbPicks.length > 0) {
          // Default sort: unreviewed first, then by rank
          const sorted = [...dbPicks].sort((a, b) => {
            const aR = !!allFeedback[a.pickId]
            const bR = !!allFeedback[b.pickId]
            if (aR === bR) return a.rank - b.rank
            return aR ? 1 : -1
          })
          setPicks(sorted)
          setSource('harmonic')
          setLoading(false)
          return
        }

        // Fall back to Claude web search
        const [cached, fbMap] = await Promise.all([
          getTodayRecs(uid),
          getFeedbackMap(uid),
        ])
        setFeedback(fbMap)

        if (cached && cached.length > 0) {
          setCompanies(cached)
        } else {
          const fresh = await generateTodayRecs(uid)
          setCompanies(fresh)
        }
        setSource('claude')
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })
  }, [navigate])

  // Load pipeline candidates when tab switches to 'pipeline'
  useEffect(() => {
    if (view !== 'pipeline' || pipeline !== null || pipelineLoading) return
    if (!userId) return

    setPipelineLoading(true)
    Promise.all([
      getLatestPipelineCandidates(),
      getPipelineFeedbackMap(userId),
    ]).then(([candidates, fbMap]) => {
      if (candidates) setPipeline(candidates)
      setPipelineFeedback(fbMap)
    }).finally(() => setPipelineLoading(false))
  }, [view, pipeline, pipelineLoading, userId])

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'rank' ? 'asc' : 'desc')
    }
  }

  // ── Derived: sorted lists ───────────────────────────────────────────────────

  const sortedPicks = useMemo(() => {
    if (!picks) return []
    return sortPicks(picks, sortKey, sortDir)
  }, [picks, sortKey, sortDir])

  const sortedPipeline = useMemo(() => {
    if (!pipeline) return []
    return sortPicks(pipeline, sortKey, sortDir)
  }, [pipeline, sortKey, sortDir])

  // ── Feedback on selected company (for drawer) ───────────────────────────────

  const selectedFeedback = selected
    ? view === 'pipeline'
      ? pipelineFeedback[selected.name]
      : pickFeedback[selected.pickId]
    : undefined

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleFeedback(company: RecCompany, entry: FeedbackEntry) {
    if (!userId) return
    setFeedback(prev => ({ ...prev, [company.name]: entry }))
    await submitFeedback(userId, company, entry)
  }

  const RECALIB_THRESHOLD = 100
  const RECALIB_STEP      = 50

  function shouldRecalibrate(count: number) {
    if (count < RECALIB_THRESHOLD) return false
    return (count - RECALIB_THRESHOLD) % RECALIB_STEP === 0
  }

  async function handlePickFeedback(pick: PickCompany, label: PickFeedbackLabel) {
    if (!userId) return
    const isNew = !pickFeedback[pick.pickId]
    setPickFeedback(prev => ({ ...prev, [pick.pickId]: label }))
    // Sync drawer feedback if this pick is selected
    if (selected?.pickId === pick.pickId) setSelected({ ...pick })
    await submitPickFeedback(userId, pick, label)

    if (isNew) {
      const newCount = totalFeedback + 1
      setTotalFeedback(newCount)
      if (shouldRecalibrate(newCount)) {
        try {
          await fetch('/api/recalibrate-scores', {
            method: 'POST',
            headers: { 'x-cron-secret': import.meta.env.VITE_CRON_SECRET ?? '' },
          })
          setRecalibToast(true)
          setTimeout(() => setRecalibToast(false), 5000)
        } catch { /* silent */ }
      }
    }
  }

  async function handlePipelineFeedback(pick: PickCompany, label: PickFeedbackLabel) {
    if (!userId) return
    setPipelineFeedback(prev => ({ ...prev, [pick.name]: label }))
    await submitCandidateFeedback(userId, pick, label)
  }

  async function handleDrawerFeedback(label: PickFeedbackLabel) {
    if (!selected) return
    if (view === 'pipeline') {
      await handlePipelineFeedback(selected, label)
    } else {
      await handlePickFeedback(selected, label)
    }
  }

  async function handleRegen() {
    if (!userId || source !== 'claude') return
    setIsRegen(true)
    setError(null)
    setMsgIdx(0)
    try {
      const fresh = await generateTodayRecs(userId)
      setCompanies(fresh)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsRegen(false)
    }
  }

  const isHarmonic   = source === 'harmonic'
  const displayCount = isHarmonic ? (picks?.length ?? 0) : companies.length

  const nextMilestone = totalFeedback < RECALIB_THRESHOLD
    ? RECALIB_THRESHOLD
    : RECALIB_THRESHOLD + Math.ceil((totalFeedback - RECALIB_THRESHOLD + 1) / RECALIB_STEP) * RECALIB_STEP
  const progressPct = Math.min(100, Math.round((totalFeedback / nextMilestone) * 100))

  // ── Render ──────────────────────────────────────────────────────────────────

  const SORT_BUTTONS: Array<{ key: SortKey; label: string }> = [
    { key: 'rank', label: 'Rank' },
    { key: 'mqs',  label: 'MQS' },
    { key: 'mus',  label: 'MUS' },
    { key: 'fit',  label: 'Fit' },
  ]

  return (
    <div className="min-h-screen bg-terrain-bg text-terrain-text font-mono">
      {/* Recalibration toast */}
      {recalibToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-terrain-surface border border-terrain-goldBorder rounded-lg px-4 py-3 text-xs font-mono text-terrain-gold shadow-lg">
          ✦ Scores updated based on your feedback
        </div>
      )}

      {/* Subtle grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(#f0ede8 1px, transparent 1px), linear-gradient(90deg, #f0ede8 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-terrain-border bg-terrain-bg/90 backdrop-blur"
        style={{ boxShadow: '0 1px 20px rgba(201,168,76,0.06), 0 1px 0 rgba(201,168,76,0.08)' }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <button
              onClick={() => navigate('/app')}
              className="font-display text-xl font-bold text-terrain-text tracking-[0.3em] uppercase hover:text-terrain-gold transition-colors"
            >
              Terrain
            </button>
            <span className="text-terrain-gold text-[10px] uppercase tracking-widest font-mono hidden sm:block">
              Daily Picks
            </span>
          </div>

          <div className="flex items-center gap-2">
            {source === 'claude' && !loading && companies.length > 0 && (
              <button
                onClick={handleRegen}
                disabled={isRegen}
                className="flex items-center gap-1.5 text-xs font-mono border border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder px-3 py-1.5 rounded transition-all duration-200 disabled:opacity-40"
              >
                {isRegen ? '···' : '↺ Refresh'}
              </button>
            )}
            <button
              onClick={() => navigate('/review')}
              className="text-xs font-mono border border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder px-3 py-1.5 rounded transition-all duration-200"
            >
              Review Dashboard
            </button>
            <button
              onClick={() => navigate('/app')}
              className="text-xs font-mono border border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder px-3 py-1.5 rounded transition-all duration-200"
            >
              ← Market Map
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Title */}
        <div className="mb-8">
          <h2 className="font-display text-2xl font-bold text-terrain-text mb-1">Today's Picks</h2>
          <p className="text-terrain-muted text-xs font-mono">{today}</p>

          {!loading && displayCount > 0 && (
            <div className="flex flex-col gap-3 mt-3">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-terrain-muted text-xs font-mono">
                  {displayCount} startups scouted to match Mucker Capital's thesis
                </p>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase tracking-widest ${
                  isHarmonic
                    ? 'border-terrain-goldBorder bg-terrain-goldDim text-terrain-gold'
                    : 'border-terrain-border text-terrain-muted'
                }`}>
                  {isHarmonic ? '⬡ Harmonic · Pre-scored' : '⬡ Claude · Web Search'}
                </span>
              </div>

              {/* Recalibration progress bar */}
              {isHarmonic && (
                <div className="max-w-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-terrain-muted uppercase tracking-widest">
                      {totalFeedback} / {nextMilestone} reviews → next recalibration
                    </span>
                  </div>
                  <div className="h-1 bg-terrain-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-terrain-gold rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* View toggle + sort — only for Harmonic picks */}
        {!loading && !isRegen && isHarmonic && picks && picks.length > 0 && (
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            {/* View tabs */}
            <div className="flex items-center gap-1 bg-terrain-surface border border-terrain-border rounded-lg p-1">
              <button
                onClick={() => setView('picks')}
                className={`px-3 py-1 rounded text-[11px] font-mono uppercase tracking-widest transition-colors ${
                  view === 'picks'
                    ? 'bg-terrain-gold text-terrain-bg font-bold'
                    : 'text-terrain-muted hover:text-terrain-text'
                }`}
              >
                Today's Picks ({picks.length})
              </button>
              <button
                onClick={() => setView('pipeline')}
                className={`px-3 py-1 rounded text-[11px] font-mono uppercase tracking-widest transition-colors ${
                  view === 'pipeline'
                    ? 'bg-terrain-gold text-terrain-bg font-bold'
                    : 'text-terrain-muted hover:text-terrain-text'
                }`}
              >
                Full Pipeline {pipeline ? `(${pipeline.length})` : ''}
              </button>
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-terrain-muted uppercase tracking-widest mr-0.5">Sort</span>
              {SORT_BUTTONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleSortClick(key)}
                  className={`px-2.5 py-1 rounded border text-[10px] font-mono transition-colors ${
                    sortKey === key
                      ? 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold'
                      : 'border-terrain-border text-terrain-muted hover:border-terrain-subtle hover:text-terrain-text'
                  }`}
                >
                  {label}{sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {(loading || isRegen) && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-6 h-6 border-2 border-terrain-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-terrain-muted text-xs font-mono tracking-wider animate-pulse">
              {LOADING_MESSAGES[msgIdx]}
            </p>
            {!isHarmonic && (
              <p className="text-terrain-muted/50 text-[10px] font-mono">
                Web search takes 20–40 seconds
              </p>
            )}
          </div>
        )}

        {/* Pipeline loading */}
        {view === 'pipeline' && pipelineLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-terrain-gold border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-xs font-mono text-terrain-muted">Loading pipeline…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && !isRegen && (
          <div className="rounded-lg border border-red-900 bg-red-950/30 px-5 py-4 text-sm font-mono text-red-400">
            <p className="font-bold mb-1">Failed to load picks</p>
            <p className="text-red-400/70 text-xs">{error}</p>
            {source === 'claude' && (
              <button
                onClick={handleRegen}
                className="mt-3 text-xs border border-red-800 text-red-400 hover:bg-red-950 px-3 py-1.5 rounded transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* ── Today's Picks view ── */}
        {!loading && !isRegen && isHarmonic && view === 'picks' && sortedPicks.length > 0 && (
          <div className="flex flex-col gap-4">
            {sortedPicks.map(pick => {
              const isReviewed = !!pickFeedback[pick.pickId]
              return (
                <div key={pick.pickId} className={isReviewed ? 'opacity-60' : undefined}>
                  {isReviewed && (
                    <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">✓ Reviewed</span>
                    </div>
                  )}
                  <PickCard
                    pick={pick}
                    feedback={pickFeedback[pick.pickId]}
                    userId={userId ?? undefined}
                    onFeedback={label => handlePickFeedback(pick, label)}
                    onSelect={() => setSelected(pick)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* ── Full Pipeline view ── */}
        {!loading && !isRegen && isHarmonic && view === 'pipeline' && !pipelineLoading && sortedPipeline.length > 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-mono text-terrain-muted/60 mb-1">
              All {sortedPipeline.length} companies from this run, sorted by score. Click a name to see full details.
            </p>
            {sortedPipeline.map(pick => {
              const fb = pipelineFeedback[pick.name]
              const isReviewed = !!fb
              return (
                <div key={pick.pickId} className={isReviewed ? 'opacity-60' : undefined}>
                  {isReviewed && (
                    <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">✓ Reviewed</span>
                    </div>
                  )}
                  <PickCard
                    pick={pick}
                    feedback={fb}
                    userId={userId ?? undefined}
                    onFeedback={label => handlePipelineFeedback(pick, label)}
                    onSelect={() => setSelected(pick)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Claude on-demand picks (fallback) */}
        {!loading && !isRegen && source === 'claude' && companies.length > 0 && (
          <div className="flex flex-col gap-4">
            {companies.map(company => (
              <RecCompanyCard
                key={company.name}
                company={company}
                feedback={feedback[company.name]}
                onFeedback={entry => handleFeedback(company, entry)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && !isRegen && displayCount > 0 && (
          <p className="mt-10 text-center text-[10px] font-mono text-terrain-muted/40 uppercase tracking-widest">
            {isHarmonic
              ? 'Sourced from Harmonic · scored with Mucker criteria · refreshed daily at 6am PT'
              : 'Rate companies to personalise tomorrow\'s picks'}
          </p>
        )}
      </main>

      {/* Detail drawer */}
      {selected && (
        <CompanyDrawer
          pick={selected}
          feedback={selectedFeedback}
          onClose={() => setSelected(null)}
          onFeedback={handleDrawerFeedback}
        />
      )}
    </div>
  )
}
