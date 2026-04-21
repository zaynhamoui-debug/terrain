import { useState, useEffect } from 'react'
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
  submitPickFeedback,
  formatRaised,
  type PickCompany,
  type PickFeedbackLabel,
} from '../lib/prospectingPicks'
import RecCompanyCard from '../components/RecCompanyCard'
import PickCard from '../components/PickCard'

const LOADING_MESSAGES = [
  'Scouting the web for startups…',
  'Screening against Mucker criteria…',
  'Verifying websites and traction…',
  'Analysing funding stage…',
  'Checking competitive dynamics…',
  'Validating market signals…',
  'Finalising top picks…',
]

export default function DailyPicks() {
  const navigate = useNavigate()
  const [userId,    setUserId]    = useState<string | null>(null)

  // Pre-computed Harmonic picks (primary)
  const [picks,     setPicks]     = useState<PickCompany[] | null>(null)
  const [pickFeedback, setPickFeedback] = useState<Record<string, PickFeedbackLabel>>({})

  // On-demand Claude picks (fallback)
  const [companies, setCompanies] = useState<RecCompany[]>([])
  const [feedback,  setFeedback]  = useState<Record<string, FeedbackEntry>>({})

  const [source,    setSource]    = useState<'harmonic' | 'claude' | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [msgIdx,    setMsgIdx]    = useState(0)
  const [error,     setError]     = useState<string | null>(null)
  const [isRegen,   setIsRegen]   = useState(false)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // Cycle loading messages
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
        // 1. Try pre-computed Harmonic picks first
        const dbPicks = await getTodayPicksFromDB()
        if (dbPicks && dbPicks.length > 0) {
          setPicks(dbPicks)
          setSource('harmonic')
          setLoading(false)
          return
        }

        // 2. Fall back to on-demand Claude web search
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

  async function handleFeedback(company: RecCompany, entry: FeedbackEntry) {
    if (!userId) return
    setFeedback(prev => ({ ...prev, [company.name]: entry }))
    await submitFeedback(userId, company, entry)
  }

  async function handlePickFeedback(pick: PickCompany, label: PickFeedbackLabel) {
    if (!userId) return
    setPickFeedback(prev => ({ ...prev, [pick.pickId]: label }))
    await submitPickFeedback(userId, pick, label)
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

  const isHarmonic    = source === 'harmonic'
  const displayCount  = isHarmonic ? (picks?.length ?? 0) : companies.length

  return (
    <div className="min-h-screen bg-terrain-bg text-terrain-text font-mono">
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
          <h2 className="font-display text-2xl font-bold text-terrain-text mb-1">
            Today's Picks
          </h2>
          <p className="text-terrain-muted text-xs font-mono">{today}</p>

          {!loading && displayCount > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <p className="text-terrain-muted text-xs font-mono">
                {displayCount} startups scouted to match Mucker Capital's thesis
              </p>
              {/* Source badge */}
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase tracking-widest ${
                isHarmonic
                  ? 'border-terrain-goldBorder bg-terrain-goldDim text-terrain-gold'
                  : 'border-terrain-border text-terrain-muted'
              }`}>
                {isHarmonic ? '⬡ Harmonic · Pre-scored' : '⬡ Claude · Web Search'}
              </span>
            </div>
          )}
        </div>

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

        {/* Harmonic pre-computed picks */}
        {!loading && !isRegen && isHarmonic && picks && picks.length > 0 && (
          <div className="flex flex-col gap-4">
            {picks.map(pick => (
              <PickCard
                key={pick.pickId}
                pick={pick}
                feedback={pickFeedback[pick.pickId]}
                onFeedback={label => handlePickFeedback(pick, label)}
              />
            ))}
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
    </div>
  )
}
