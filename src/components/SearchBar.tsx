import { useState, FormEvent } from 'react'

export type SearchMode = 'market' | 'company'

interface Props {
  onSearch:      (query: string) => void
  isLoading:     boolean
  searchMode?:   SearchMode
  onModeChange?: (mode: SearchMode) => void
}

// Clay uses LinkedIn Industry Codes V2 — these are the 20 root sectors
const CATEGORY_ORDER = [
  'Technology, Information and Media',
  'Financial Services',
  'Hospitals and Health Care',
  'Professional Services',
  'Manufacturing',
  'Retail',
  'Consumer Services',
  'Education',
  'Transportation, Logistics, Supply Chain and Storage',
  'Construction',
  'Administrative and Support Services',
  'Real Estate and Equipment Rental Services',
  'Entertainment Providers',
  'Wholesale',
  'Utilities',
  'Oil, Gas, and Mining',
  'Farming, Ranching, Forestry',
  'Accommodation Services',
  'Government Administration',
  'Holding Companies',
]

const CATEGORY_COLORS: Record<string, string> = {
  'Technology, Information and Media':                    'text-blue-400   border-blue-400/30   hover:border-blue-400/70   hover:text-blue-300',
  'Financial Services':                                   'text-terrain-gold border-terrain-goldBorder/30 hover:border-terrain-goldBorder hover:text-terrain-gold',
  'Hospitals and Health Care':                            'text-emerald-400 border-emerald-400/30 hover:border-emerald-400/70 hover:text-emerald-300',
  'Professional Services':                                'text-violet-400  border-violet-400/30  hover:border-violet-400/70  hover:text-violet-300',
  'Manufacturing':                                        'text-stone-400   border-stone-400/30   hover:border-stone-400/70   hover:text-stone-300',
  'Retail':                                               'text-pink-400    border-pink-400/30    hover:border-pink-400/70    hover:text-pink-300',
  'Consumer Services':                                    'text-rose-400    border-rose-400/30    hover:border-rose-400/70    hover:text-rose-300',
  'Education':                                            'text-cyan-400    border-cyan-400/30    hover:border-cyan-400/70    hover:text-cyan-300',
  'Transportation, Logistics, Supply Chain and Storage':  'text-sky-400     border-sky-400/30     hover:border-sky-400/70     hover:text-sky-300',
  'Construction':                                         'text-orange-400  border-orange-400/30  hover:border-orange-400/70  hover:text-orange-300',
  'Administrative and Support Services':                  'text-slate-400   border-slate-400/30   hover:border-slate-400/70   hover:text-slate-300',
  'Real Estate and Equipment Rental Services':            'text-amber-400   border-amber-400/30   hover:border-amber-400/70   hover:text-amber-300',
  'Entertainment Providers':                              'text-purple-400  border-purple-400/30  hover:border-purple-400/70  hover:text-purple-300',
  'Wholesale':                                            'text-teal-400    border-teal-400/30    hover:border-teal-400/70    hover:text-teal-300',
  'Utilities':                                            'text-green-400   border-green-400/30   hover:border-green-400/70   hover:text-green-300',
  'Oil, Gas, and Mining':                                 'text-yellow-400  border-yellow-400/30  hover:border-yellow-400/70  hover:text-yellow-300',
  'Farming, Ranching, Forestry':                          'text-lime-400    border-lime-400/30    hover:border-lime-400/70    hover:text-lime-300',
  'Accommodation Services':                               'text-indigo-400  border-indigo-400/30  hover:border-indigo-400/70  hover:text-indigo-300',
  'Government Administration':                            'text-red-400     border-red-400/30     hover:border-red-400/70     hover:text-red-300',
  'Holding Companies':                                    'text-terrain-muted border-terrain-border hover:border-terrain-subtle hover:text-terrain-text',
}

const FUNDING_STAGES   = ['Pre-Seed', 'Seed', 'Series A', 'Series B']
const HEADCOUNT_RANGES = ['1–10', '11–50', '51–200', '201–500', '500+']
const LOCATIONS        = ['Los Angeles', 'New York', 'San Francisco', 'Austin', 'Miami', 'Chicago', 'United States', 'Latin America']

interface Filters {
  stage:     string[]
  headcount: string[]
  location:  string
  keywords:  string
}

function buildFilterSuffix(filters: Filters): string {
  const parts: string[] = []
  if (filters.stage.length)     parts.push(`${filters.stage.join(' or ')} stage`)
  if (filters.location)         parts.push(`in ${filters.location}`)
  if (filters.headcount.length) parts.push(`${filters.headcount.join(' or ')} employees`)
  if (filters.keywords)         parts.push(filters.keywords)
  return parts.length ? `, ${parts.join(', ')}` : ''
}

const EMPTY_FILTERS: Filters = { stage: [], headcount: [], location: '', keywords: '' }

function hasActiveFilters(f: Filters) {
  return f.stage.length > 0 || f.headcount.length > 0 || !!f.location || !!f.keywords
}

export default function SearchBar({ onSearch, isLoading, searchMode = 'market', onModeChange }: Props) {
  const [query,       setQuery]       = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters,     setFilters]     = useState<Filters>(EMPTY_FILTERS)

  function toggleChip(field: 'stage' | 'headcount', value: string) {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isLoading) return
    if (searchMode === 'company') {
      if (query.trim()) onSearch(query.trim())
      return
    }
    const base = query.trim()
    if (!base) return
    const full = base + buildFilterSuffix(filters)
    onSearch(full)
  }

  function handleChip(industry: string) {
    if (isLoading) return
    const full = industry + buildFilterSuffix(filters)
    onSearch(full)
  }

  const MODES: Array<{ key: SearchMode; icon: string; label: string }> = [
    { key: 'market',  icon: '⬡', label: 'Sector Map'     },
    { key: 'company', icon: '◎', label: 'Company Lookup' },
  ]

  const activeFilterCount = filters.stage.length + filters.headcount.length +
    (filters.location ? 1 : 0) + (filters.keywords ? 1 : 0)

  return (
    <div className="max-w-3xl mx-auto">

      {/* Mode toggle */}
      {onModeChange && (
        <div className="flex items-center gap-1 bg-terrain-surface border border-terrain-border rounded-lg p-1 w-fit mb-4">
          {MODES.map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onModeChange(key)}
              className={`px-4 py-1.5 rounded text-[11px] font-mono uppercase tracking-widest transition-colors ${
                searchMode === key
                  ? 'bg-terrain-gold text-terrain-bg font-bold'
                  : 'text-terrain-muted hover:text-terrain-text'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={isLoading}
            placeholder={
              searchMode === 'company'
                ? 'Company domain, name, or LinkedIn URL…'
                : 'Enter a vertical or sector (e.g. Construction SaaS, HealthTech, Fintech)…'
            }
            className="w-full bg-terrain-surface border border-terrain-border rounded-lg px-5 py-4 pr-36 text-terrain-text text-sm font-mono placeholder-terrain-muted focus:outline-none focus:border-terrain-gold transition-colors disabled:opacity-60"
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {/* Filter toggle — only in market mode */}
            {searchMode === 'market' && (
              <button
                type="button"
                onClick={() => setShowFilters(v => !v)}
                disabled={isLoading}
                className={`px-2.5 py-1.5 rounded text-[10px] font-mono border transition-all duration-150 ${
                  showFilters || activeFilterCount > 0
                    ? 'border-terrain-goldBorder bg-terrain-goldDim text-terrain-gold'
                    : 'border-terrain-border text-terrain-muted hover:border-terrain-subtle hover:text-terrain-text'
                }`}
              >
                {activeFilterCount > 0 ? `⊕ ${activeFilterCount}` : '⊕ Filter'}
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 bg-terrain-gold text-terrain-bg text-xs font-bold rounded tracking-widest uppercase hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isLoading ? '···' : searchMode === 'company' ? 'LOOKUP →' : 'MAP →'}
            </button>
          </div>
        </div>

        {/* Expandable filter panel */}
        {searchMode === 'market' && showFilters && (
          <div className="mt-2 rounded-lg border border-terrain-border bg-terrain-surface px-4 py-4 flex flex-col gap-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Funding Stage */}
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                  Funding Stage
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {FUNDING_STAGES.map(s => (
                    <button
                      key={s} type="button"
                      onClick={() => toggleChip('stage', s)}
                      className={`text-[10px] font-mono border px-2.5 py-1 rounded transition-colors ${
                        filters.stage.includes(s)
                          ? 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold'
                          : 'border-terrain-border text-terrain-muted hover:border-terrain-subtle hover:text-terrain-text'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* Headcount */}
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                  Headcount
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {HEADCOUNT_RANGES.map(h => (
                    <button
                      key={h} type="button"
                      onClick={() => toggleChip('headcount', h)}
                      className={`text-[10px] font-mono border px-2.5 py-1 rounded transition-colors ${
                        filters.headcount.includes(h)
                          ? 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold'
                          : 'border-terrain-border text-terrain-muted hover:border-terrain-subtle hover:text-terrain-text'
                      }`}
                    >{h}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* HQ Location */}
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                  HQ Location
                </label>
                <input
                  list="location-list"
                  value={filters.location}
                  onChange={e => setFilters(p => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Los Angeles, United States…"
                  className="w-full bg-terrain-bg border border-terrain-border rounded px-3 py-1.5 text-terrain-text text-xs font-mono placeholder-terrain-muted/50 focus:outline-none focus:border-terrain-gold transition-colors"
                />
                <datalist id="location-list">
                  {LOCATIONS.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>

              {/* Keywords */}
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                  Keywords / Thesis
                </label>
                <input
                  value={filters.keywords}
                  onChange={e => setFilters(p => ({ ...p, keywords: e.target.value }))}
                  placeholder="e.g. operator founder, workflow automation…"
                  className="w-full bg-terrain-bg border border-terrain-border rounded px-3 py-1.5 text-terrain-text text-xs font-mono placeholder-terrain-muted/50 focus:outline-none focus:border-terrain-gold transition-colors"
                />
              </div>
            </div>

            {/* Preview + clear */}
            <div className="flex items-center justify-between">
              {hasActiveFilters(filters) ? (
                <p className="text-[9px] font-mono text-terrain-muted/60 italic truncate">
                  Will search: "{(query.trim() || '<sector>') + buildFilterSuffix(filters)}"
                </p>
              ) : (
                <p className="text-[9px] font-mono text-terrain-muted/40">
                  Filters narrow the market search
                </p>
              )}
              {hasActiveFilters(filters) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[9px] font-mono text-terrain-muted hover:text-red-400 transition-colors ml-3 shrink-0"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        )}
      </form>

      {/* Industry chips — Sector Map mode only */}
      {searchMode === 'market' && (
        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map(cat => {
            const colorClass = CATEGORY_COLORS[cat] ?? ''
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleChip(cat)}
                disabled={isLoading}
                className={`text-[11px] font-mono border px-3 py-1.5 rounded transition-colors disabled:opacity-40 ${colorClass}`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
