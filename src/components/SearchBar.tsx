import { useState, FormEvent } from 'react'

const EXAMPLE_SECTORS = [
  'AI infrastructure', 'Climate tech', 'Developer tools',
  'B2B payments', 'Defence tech', 'Healthcare AI',
  'Vertical SaaS', 'Web3 infrastructure',
]

interface Props {
  onSearch: (query: string) => void
  isLoading: boolean
}

export default function SearchBar({ onSearch, isLoading }: Props) {
  const [query, setQuery] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q && !isLoading) onSearch(q)
  }

  function handleChip(sector: string) {
    if (isLoading) return
    setQuery(sector)
    onSearch(sector)
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

      <div className="flex flex-wrap gap-2 mt-4">
        {EXAMPLE_SECTORS.map(sector => (
          <button
            key={sector}
            onClick={() => handleChip(sector)}
            disabled={isLoading}
            className="text-xs text-terrain-muted border border-terrain-border px-3 py-1.5 rounded hover:border-terrain-subtle hover:text-terrain-text transition-colors disabled:opacity-40 font-mono"
          >
            {sector}
          </button>
        ))}
      </div>
    </div>
  )
}
