import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface ReviewRow {
  id:               string
  name:             string
  sector:           string | null
  stage:            string | null
  review_count:     number
  reviewer_count:   number
  labels:           string[] | null
  last_reviewed_at: string | null
  first_shown_date: string | null
  // From join to prospecting_candidates
  mqs?:             number
  mus?:             number
  combined_score?:  number
}

interface ExpandedNotes {
  user_id:          string
  label:            string
  structured_notes: Record<string, string> | null
  created_at:       string
}

const LABEL_COLORS: Record<string, string> = {
  intro_requested: 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold',
  like:            'bg-emerald-950 border-emerald-700 text-emerald-400',
  dislike:         'bg-red-950 border-red-800 text-red-400',
  not_relevant:    'bg-red-950 border-red-800 text-red-400',
  already_known:   'bg-slate-800 border-slate-600 text-slate-300',
  too_late:        'bg-orange-950 border-orange-700 text-orange-400',
}

const NOTE_LABELS: Record<string, string> = {
  market_note:         'Market',
  team_note:           'Team',
  traction_note:       'Traction',
  business_model_note: 'Business Model',
  under_radar_note:    'Under-Radar',
  risks_note:          'Risks',
}

type TabFilter = 'all' | 'unreviewed' | 'reviewed'

export default function ReviewDashboard() {
  const navigate = useNavigate()
  const [rows,         setRows]         = useState<ReviewRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<TabFilter>('all')
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<ExpandedNotes[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [lastRecalib,  setLastRecalib]  = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { navigate('/login'); return }
      await loadData()
    })
  }, [navigate])

  async function loadData() {
    setLoading(true)

    const [reviewRes, recalibRes] = await Promise.all([
      supabase
        .from('prospecting_review_status')
        .select('*')
        .order('review_count', { ascending: false }),
      supabase
        .from('scoring_recalibration_log')
        .select('triggered_at')
        .order('triggered_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    if (reviewRes.data) {
      // Enrich with latest candidate scores
      const companyIds = reviewRes.data.map((r: ReviewRow) => r.id)
      const { data: candidateData } = await supabase
        .from('prospecting_candidates')
        .select('company_id, mqs, mus, combined_score')
        .in('company_id', companyIds)

      const scoreMap: Record<string, { mqs: number; mus: number; combined_score: number }> = {}
      for (const c of (candidateData ?? [])) {
        scoreMap[c.company_id] = c
      }

      const enriched = reviewRes.data.map((r: ReviewRow) => ({
        ...r,
        ...(scoreMap[r.id] ?? {}),
      }))
      setRows(enriched)
    }

    if (recalibRes.data) {
      setLastRecalib(recalibRes.data.triggered_at)
    }

    setLoading(false)
  }

  async function loadNotes(companyId: string) {
    setNotesLoading(true)
    const { data } = await supabase
      .from('prospecting_feedback')
      .select('user_id, label, structured_notes, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    setExpandedNotes((data ?? []) as ExpandedNotes[])
    setNotesLoading(false)
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedNotes([])
    } else {
      setExpandedId(id)
      loadNotes(id)
    }
  }

  const filtered = rows.filter(r => {
    if (tab === 'unreviewed') return (r.review_count ?? 0) === 0
    if (tab === 'reviewed')   return (r.review_count ?? 0) > 0
    return true
  })

  const totalCompanies  = rows.length
  const totalReviewed   = rows.filter(r => (r.review_count ?? 0) > 0).length
  const totalUnreviewed = totalCompanies - totalReviewed

  return (
    <div className="min-h-screen bg-terrain-bg text-terrain-text font-mono">
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-terrain-border bg-terrain-bg/90 backdrop-blur"
        style={{ boxShadow: '0 1px 20px rgba(201,168,76,0.06), 0 1px 0 rgba(201,168,76,0.08)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <button
              onClick={() => navigate('/app')}
              className="font-display text-xl font-bold text-terrain-text tracking-[0.3em] uppercase hover:text-terrain-gold transition-colors"
            >
              Terrain
            </button>
            <span className="text-terrain-gold text-[10px] uppercase tracking-widest font-mono hidden sm:block">
              Review Dashboard
            </span>
          </div>
          <button
            onClick={() => navigate('/daily')}
            className="text-xs font-mono border border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder px-3 py-1.5 rounded transition-all duration-200"
          >
            ← Daily Picks
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Stats header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total in Pipeline', value: totalCompanies },
            { label: 'Reviewed',          value: totalReviewed,   color: 'text-emerald-400' },
            { label: 'Unreviewed',        value: totalUnreviewed, color: 'text-terrain-muted' },
            {
              label: 'Last Recalibration',
              value: lastRecalib
                ? new Date(lastRecalib).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '—',
              color: 'text-terrain-gold',
            },
          ].map(stat => (
            <div key={stat.label} className="rounded-lg bg-terrain-surface border border-terrain-border px-4 py-3">
              <p className={`text-lg font-bold font-display ${stat.color ?? 'text-terrain-text'}`}>
                {stat.value}
              </p>
              <p className="text-[9px] font-mono text-terrain-muted uppercase tracking-widest mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Tab filter */}
        <div className="flex gap-2 mb-5">
          {(['all', 'unreviewed', 'reviewed'] as TabFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded border text-[11px] font-mono capitalize transition-all duration-150 ${
                tab === t
                  ? 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold'
                  : 'border-terrain-border text-terrain-muted hover:border-terrain-subtle hover:text-terrain-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-terrain-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[9px] font-mono text-terrain-muted uppercase tracking-widest border-b border-terrain-border">
              <div className="col-span-3">Company</div>
              <div className="col-span-2">Sector / Stage</div>
              <div className="col-span-1 text-center">MQS</div>
              <div className="col-span-1 text-center">MUS</div>
              <div className="col-span-1 text-center">Fit</div>
              <div className="col-span-1 text-center">Reviews</div>
              <div className="col-span-2">Labels</div>
              <div className="col-span-1 text-right">Last Seen</div>
            </div>

            {filtered.length === 0 && (
              <p className="text-terrain-muted text-xs font-mono text-center py-12">No companies found.</p>
            )}

            {filtered.map(row => (
              <div key={row.id}>
                <button
                  onClick={() => toggleExpand(row.id)}
                  className={`w-full grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg border text-left transition-all duration-150 ${
                    expandedId === row.id
                      ? 'bg-terrain-surface border-terrain-goldBorder/40'
                      : 'bg-terrain-surface border-terrain-border hover:border-terrain-subtle'
                  }`}
                >
                  <div className="col-span-3 flex items-center">
                    <span className="text-xs font-mono text-terrain-text truncate">{row.name}</span>
                  </div>
                  <div className="col-span-2 flex flex-col justify-center gap-0.5">
                    {row.sector && (
                      <span className="text-[9px] font-mono text-terrain-muted truncate">{row.sector}</span>
                    )}
                    {row.stage && (
                      <span className="text-[9px] font-mono text-terrain-muted/60 truncate">{row.stage}</span>
                    )}
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <span className={`text-xs font-mono font-bold ${
                      (row.mqs ?? 0) >= 70 ? 'text-emerald-400' : (row.mqs ?? 0) >= 50 ? 'text-terrain-gold' : 'text-terrain-muted'
                    }`}>{row.mqs ?? '—'}</span>
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <span className={`text-xs font-mono font-bold ${
                      (row.mus ?? 0) >= 70 ? 'text-emerald-400' : (row.mus ?? 0) >= 50 ? 'text-terrain-gold' : 'text-terrain-muted'
                    }`}>{row.mus ?? '—'}</span>
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <span className={`text-xs font-mono font-bold ${
                      (row.combined_score ?? 0) >= 70 ? 'text-emerald-400' : (row.combined_score ?? 0) >= 50 ? 'text-terrain-gold' : 'text-terrain-muted'
                    }`}>{row.combined_score ?? '—'}</span>
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {(row.review_count ?? 0) > 0 ? (
                      <span className="text-[10px] font-mono bg-terrain-bg border border-terrain-border rounded px-1.5 py-0.5 text-terrain-text">
                        {row.review_count}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-terrain-muted/40">—</span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center gap-1 flex-wrap">
                    {(row.labels ?? []).filter(Boolean).slice(0, 3).map(label => (
                      <span
                        key={label}
                        className={`text-[8px] font-mono px-1 py-0.5 rounded border ${LABEL_COLORS[label] ?? 'border-terrain-border text-terrain-muted'}`}
                      >
                        {label.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <span className="text-[9px] font-mono text-terrain-muted/60">
                      {row.last_reviewed_at
                        ? new Date(row.last_reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : row.first_shown_date
                          ? new Date(row.first_shown_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                    </span>
                  </div>
                </button>

                {/* Expanded notes */}
                {expandedId === row.id && (
                  <div className="ml-3 mr-3 mb-2 border border-terrain-border border-t-0 rounded-b-lg bg-terrain-bg px-4 py-3">
                    {notesLoading ? (
                      <p className="text-[10px] font-mono text-terrain-muted animate-pulse">Loading notes…</p>
                    ) : expandedNotes.length === 0 ? (
                      <p className="text-[10px] font-mono text-terrain-muted">No review notes yet.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {expandedNotes.map((n, i) => (
                          <div key={i} className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-mono px-1 py-0.5 rounded border ${LABEL_COLORS[n.label] ?? 'border-terrain-border text-terrain-muted'}`}>
                                {n.label.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] font-mono text-terrain-muted/50">
                                {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            {n.structured_notes && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.entries(n.structured_notes)
                                  .filter(([, v]) => v)
                                  .map(([key, value]) => (
                                    <div key={key}>
                                      <p className="text-[8px] font-mono text-terrain-muted uppercase tracking-widest mb-0.5">
                                        {NOTE_LABELS[key] ?? key}
                                      </p>
                                      <p className="text-[10px] font-mono text-terrain-text/80 leading-relaxed">
                                        {value as string}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
