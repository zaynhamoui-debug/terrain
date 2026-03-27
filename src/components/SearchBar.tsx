import { useState, FormEvent } from 'react'

interface Props {
  onSearch: (query: string) => void
  isLoading: boolean
  industries?: string[]
}

export default function SearchBar({ onSearch, isLoading, industries = [] }: Props) {
  const [query, setQuery] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q && !isLoading) onSearch(q)
  }

  function handleChip(industry: string) {
    if (isLoading) return
    setQuery(industry)
    onSearch(industry)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={isLoading}
          placeholder="Enter a sector or company name…"
          className="w-full bg-terrain-surface border border-terrain-border rounded-lg px-5 py-4 pr-28 text-terrain-text text-sm font-mono placeholder-terrain-muted focus:outline-none focus:border-terrain-gold transition-colors disabled:opacity-60"
          autoFocus
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-terrain-gold text-terrain-bg text-xs font-bold rounded tracking-widest uppercase hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {isLoading ? '···' : 'MAP →'}
        </button>
      </form>

      {industries.length > 0 && (
        <div className="mt-4">
          <p className="text-terrain-muted text-[10px] font-mono uppercase tracking-widest mb-2">
            Industries in database
          </p>
          <div className="flex flex-wrap gap-2">
            {industries.map(industry => (
              <button
                key={industry}
                onClick={() => handleChip(industry)}
                disabled={isLoading}
                className="text-[11px] text-terrain-muted border border-terrain-border px-3 py-1 rounded hover:border-terrain-goldBorder hover:text-terrain-gold transition-colors disabled:opacity-40 font-mono"
              >
                {industry}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
