import { MarketMap } from '../types/marketMap'

export function exportCSV(map: MarketMap): void {
  const headers = [
    'Segment', 'Company', 'Tagline', 'Stage', 'Funding', 'Valuation',
    'Founded', 'HQ', 'Headcount', 'Website', 'Momentum', 'Last Round',
    'Investors', 'Key Customers', 'Differentiator',
  ]

  const rows = map.segments.flatMap(seg =>
    seg.companies.map(c =>
      [
        seg.name, c.name, c.tagline, c.stage,
        c.funding_display, c.valuation_display, c.founded,
        c.hq, c.headcount_range, c.website, c.momentum_signal,
        c.last_round, c.investors.join('; '),
        c.key_customers.join('; '), c.differentiator,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    )
  )

  const csv  = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: `${map.sector.replace(/\s+/g, '_')}_terrain.csv` })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function printMap(): void {
  window.print()
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}
