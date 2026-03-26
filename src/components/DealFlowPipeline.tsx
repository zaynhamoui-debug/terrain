import { useState, useEffect } from 'react'
import { Company } from '../types/marketMap'
import { supabase } from '../lib/supabase'

interface DealFlowEntry {
  id: string
  company_id: string
  company_name: string
  company_data: Company | null
  status: string
  notes: string
  updated_at: string
}

interface Props {
  onCompanyClick: (company: Company) => void
}

const COLUMNS: { key: string; label: string; color: string; textColor: string }[] = [
  { key: 'watching',      label: 'Watching',      color: '#1e3a5f', textColor: '#60a5fa' },
  { key: 'outreach',      label: 'Outreach',      color: '#3b2a00', textColor: '#fbbf24' },
  { key: 'meeting',       label: 'Meeting',        color: '#3b1a00', textColor: '#fb923c' },
  { key: 'due_diligence', label: 'Due Diligence',  color: '#2e1a5f', textColor: '#c084fc' },
  { key: 'portfolio',     label: 'Portfolio',      color: '#052e16', textColor: '#4ade80' },
  { key: 'passed',        label: 'Passed',         color: '#3b0a0a', textColor: '#f87171' },
]

export default function DealFlowPipeline({ onCompanyClick }: Props) {
  const [entries,   setEntries]   = useState<DealFlowEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [dragging,  setDragging]  = useState<string | null>(null)
  const [dragOver,  setDragOver]  = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('deal_flow')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setEntries(data as DealFlowEntry[])
    setLoading(false)
  }

  async function moveEntry(entryId: string, newStatus: string) {
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: newStatus } : e))
    await supabase
      .from('deal_flow')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', entryId)
  }

  async function removeEntry(entryId: string) {
    if (!window.confirm('Remove from pipeline?')) return
    setEntries(prev => prev.filter(e => e.id !== entryId))
    await supabase.from('deal_flow').delete().eq('id', entryId)
  }

  function handleDragStart(entryId: string) {
    setDragging(entryId)
  }

  function handleDrop(colKey: string) {
    if (dragging) moveEntry(dragging, colKey)
    setDragging(null)
    setDragOver(null)
  }

  const grouped = COLUMNS.reduce<Record<string, DealFlowEntry[]>>((acc, col) => {
    acc[col.key] = entries.filter(e => e.status === col.key)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-8 h-8 border border-terrain-border rounded-full" />
          <div className="absolute inset-0 w-8 h-8 border-t border-terrain-gold rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-terrain-muted text-4xl mb-4">⬡</div>
        <p className="text-terrain-muted text-sm font-mono">No companies in your pipeline yet.</p>
        <p className="text-terrain-subtle text-xs font-mono mt-2">Open a company and set a deal status to add it here.</p>
      </div>
    )
  }

  return (
    <div className="mt-6 overflow-x-auto pb-6">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map(col => {
          const colEntries = grouped[col.key] ?? []
          const isOver = dragOver === col.key
          return (
            <div
              key={col.key}
              className={`w-64 flex flex-col rounded-lg border transition-colors ${
                isOver ? 'border-terrain-gold' : 'border-terrain-border'
              }`}
              style={{ backgroundColor: col.color + '33' }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-4 py-3 rounded-t-lg border-b border-terrain-border"
                style={{ backgroundColor: col.color + '66' }}
              >
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest" style={{ color: col.textColor }}>
                  {col.label}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ color: col.textColor, borderColor: col.textColor + '44' }}>
                  {colEntries.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-3 p-3 flex-1 min-h-[120px]">
                {colEntries.map(entry => (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={() => handleDragStart(entry.id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null) }}
                    className={`group bg-terrain-surface border border-terrain-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all ${
                      dragging === entry.id ? 'opacity-40' : 'hover:border-terrain-subtle'
                    }`}
                  >
                    {/* Company name */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <button
                        onClick={() => entry.company_data && onCompanyClick(entry.company_data)}
                        disabled={!entry.company_data}
                        className="font-display font-semibold text-sm text-terrain-text hover:text-terrain-gold transition-colors text-left leading-tight disabled:cursor-default"
                      >
                        {entry.company_name}
                      </button>
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="text-terrain-muted hover:text-red-400 text-base leading-none opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title="Remove from pipeline"
                      >
                        ×
                      </button>
                    </div>

                    {/* Tagline */}
                    {entry.company_data?.tagline && (
                      <p className="text-terrain-muted text-[10px] font-mono leading-relaxed line-clamp-2 mb-2">
                        {entry.company_data.tagline}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.company_data?.stage && (
                        <span className="text-[9px] font-mono text-terrain-muted border border-terrain-border px-1.5 py-0.5 rounded">
                          {entry.company_data.stage}
                        </span>
                      )}
                      {entry.company_data?.funding_display && entry.company_data.funding_display !== '$0' && (
                        <span className="text-[9px] font-mono text-terrain-gold font-bold">
                          {entry.company_data.funding_display}
                        </span>
                      )}
                      {entry.company_data?.momentum_signal && (
                        <span className="text-[10px]" title={entry.company_data.momentum_signal}>
                          {entry.company_data.momentum_signal.split(' ')[0]}
                        </span>
                      )}
                    </div>

                    {/* Move buttons */}
                    <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                      {COLUMNS.filter(c => c.key !== col.key).map(c => (
                        <button
                          key={c.key}
                          onClick={() => moveEntry(entry.id, c.key)}
                          className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-terrain-border text-terrain-muted hover:text-terrain-gold hover:border-terrain-goldBorder transition-colors"
                        >
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {colEntries.length === 0 && (
                  <div className={`flex-1 flex items-center justify-center rounded border-2 border-dashed transition-colors min-h-[80px] ${
                    isOver ? 'border-terrain-gold' : 'border-terrain-border/30'
                  }`}>
                    <span className="text-terrain-border text-[10px] font-mono">Drop here</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
