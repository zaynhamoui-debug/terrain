import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { MarketMap, Company } from '../types/marketMap'

const TIER_COLS = [
  { key: 'Field Leader',  emoji: '👑', label: 'Field Leaders',  color: '#d97706', bg: '#1c1407' },
  { key: 'Challenger',    emoji: '⚔️',  label: 'Challengers',    color: '#3b82f6', bg: '#0c1a2e' },
  { key: 'Up and Comer',  emoji: '🚀', label: 'Up and Comers',  color: '#10b981', bg: '#061a12' },
  { key: 'Startup',       emoji: '💡', label: 'Startups',       color: '#8b5cf6', bg: '#130c2e' },
  { key: 'Niche Player',  emoji: '🎯', label: 'Niche Players',  color: '#9ca3af', bg: '#111111' },
] as const

interface Props {
  map: MarketMap
  onClose: () => void
}

function CompanyCell({ company }: { company: Company }) {
  return (
    <div style={{
      padding: '6px 8px',
      borderRadius: 4,
      backgroundColor: company.is_focal_company ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${company.is_focal_company ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
      marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {company.is_focal_company && (
          <span style={{ color: '#c9a84c', fontSize: 9, fontWeight: 700 }}>★</span>
        )}
        <span style={{
          color: company.is_focal_company ? '#c9a84c' : '#e5e0d8',
          fontSize: 11,
          fontWeight: company.is_focal_company ? 700 : 600,
          fontFamily: 'monospace',
          lineHeight: 1.3,
        }}>
          {company.name}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
        {company.stage && (
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#6b7280' }}>
            {company.stage}
          </span>
        )}
        {company.funding_display && company.funding_display !== '$0' && (
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#9ca3af' }}>
            {company.funding_display}
          </span>
        )}
      </div>
    </div>
  )
}

export default function LandscapeExport({ map, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const allCompanies = map.segments.flatMap(s => s.companies)
  const focal = allCompanies.find(c => c.is_focal_company)
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  async function handleExport() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0d0d0d',
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${(map.focal_company ?? map.sector).replace(/\s+/g, '_')}_landscape.png`
      a.click()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex flex-col items-center justify-start overflow-y-auto py-8 px-4">
      <div className="w-full max-w-5xl">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-terrain-muted text-xs font-mono">Preview — export as PNG for presentations</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2 bg-terrain-gold text-terrain-bg text-xs font-bold rounded tracking-widest uppercase hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {exporting ? '···' : '↓ Download PNG'}
            </button>
            <button
              onClick={onClose}
              className="text-terrain-muted hover:text-terrain-text text-xs font-mono transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* The exportable card */}
        <div
          ref={cardRef}
          style={{
            backgroundColor: '#0d0d0d',
            borderRadius: 12,
            padding: 32,
            fontFamily: 'monospace',
            border: '1px solid rgba(201,168,76,0.2)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ color: '#c9a84c', fontSize: 11, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' }}>
                  TERRAIN
                </span>
                <span style={{ color: '#444', fontSize: 11 }}>·</span>
                <span style={{ color: '#666', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Competitive Landscape
                </span>
              </div>
              <div style={{ color: '#e5e0d8', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>
                {focal?.name ?? map.focal_company ?? map.sector}
              </div>
              <div style={{ color: '#9ca3af', fontSize: 11 }}>{map.sector}</div>
              {map.summary && (
                <div style={{ color: '#6b7280', fontSize: 10, marginTop: 8, maxWidth: 500, lineHeight: 1.6 }}>
                  {map.summary}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#c9a84c', fontSize: 18, fontWeight: 700 }}>{map.total_market_size}</div>
              <div style={{ color: '#555', fontSize: 10, marginTop: 4 }}>{today}</div>
            </div>
          </div>

          {/* Tier columns header */}
          <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${TIER_COLS.length}, 1fr)`, gap: 8, marginBottom: 8 }}>
            <div />
            {TIER_COLS.map(col => (
              <div key={col.key} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 6, backgroundColor: col.bg, border: `1px solid ${col.color}22` }}>
                <div style={{ fontSize: 14 }}>{col.emoji}</div>
                <div style={{ color: col.color, fontSize: 10, fontWeight: 700, marginTop: 3, letterSpacing: '0.05em' }}>
                  {col.label}
                </div>
              </div>
            ))}
          </div>

          {/* Rows per segment */}
          {map.segments.filter(seg => seg.companies.length > 0).map(seg => (
            <div
              key={seg.id}
              style={{ display: 'grid', gridTemplateColumns: `160px repeat(${TIER_COLS.length}, 1fr)`, gap: 8, marginBottom: 8 }}
            >
              {/* Segment label */}
              <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 4, gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: seg.color, marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#c4bfb8', fontSize: 10, fontWeight: 700, lineHeight: 1.3 }}>{seg.name}</div>
                  <div style={{ color: '#444', fontSize: 9, marginTop: 2, lineHeight: 1.4 }}>{seg.companies.length} co.</div>
                </div>
              </div>

              {/* Tier cells */}
              {TIER_COLS.map(col => {
                const companies = seg.companies.filter(c => c.market_tier === col.key)
                return (
                  <div key={col.key} style={{ padding: '4px 2px', minHeight: 40 }}>
                    {companies.map(c => (
                      <CompanyCell key={c.id} company={c} />
                    ))}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Footer */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {TIER_COLS.map(col => {
                const count = allCompanies.filter(c => c.market_tier === col.key).length
                if (count === 0) return null
                return (
                  <span key={col.key} style={{ color: col.color, fontSize: 9, fontFamily: 'monospace' }}>
                    {col.emoji} {count} {col.label}
                  </span>
                )
              })}
            </div>
            <span style={{ color: '#333', fontSize: 9, letterSpacing: '0.1em' }}>terrain-two.vercel.app</span>
          </div>
        </div>
      </div>
    </div>
  )
}
