import { useState, FormEvent } from 'react'

export type SearchMode = 'market' | 'company' | 'custom'

interface Props {
  onSearch:     (query: string) => void
  isLoading:    boolean
  industries?:  string[]
  searchMode?:  SearchMode
  onModeChange?: (mode: SearchMode) => void
}

// ─── Clay industry taxonomy ───────────────────────────────────────────────────
// Maps LinkedIn/raw industry strings → Clay's cleaner vertical labels

const CATEGORY_MAP: Record<string, string> = {
  // Software & IT
  'Software Development':                           'Software & IT',
  'IT Services and IT Consulting':                  'Software & IT',
  'Technology, Information and Internet':           'Software & IT',
  'Technology, Information and Media':              'Software & IT',
  'Information Technology and Services':            'Software & IT',
  'Information Services':                           'Software & IT',
  'Computer and Network Security':                  'Software & IT',
  'Computer Hardware':                              'Software & IT',
  'Computer Hardware Manufacturing':                'Software & IT',
  'Computer Networking':                            'Software & IT',
  'Computer Networking Products':                   'Software & IT',
  'Computers and Electronics Manufacturing':        'Software & IT',
  'Data Infrastructure and Analytics':              'Software & IT',
  'Data Security Software Products':                'Software & IT',
  'Desktop Computing Software Products':            'Software & IT',
  'Embedded Software Products':                     'Software & IT',
  'IT System Custom Software Development':          'Software & IT',
  'IT System Data Services':                        'Software & IT',
  'IT System Training and Support':                 'Software & IT',
  'Mobile Computing Software Products':             'Software & IT',
  'Semiconductor Manufacturing':                    'Software & IT',
  'Semiconductors':                                 'Software & IT',
  'Automation Machinery Manufacturing':             'Software & IT',
  'Industrial Automation':                          'Software & IT',
  'Robotics Engineering':                           'Software & IT',
  'Robot Manufacturing':                            'Software & IT',
  'Blockchain Services':                            'Software & IT',
  'Computer Games':                                 'Software & IT',
  'Mobile Gaming Apps':                             'Software & IT',
  'Social Networking Platforms':                    'Software & IT',
  'Internet Marketplace Platforms':                 'Software & IT',
  'Internet News':                                  'Software & IT',
  'Internet Publishing':                            'Software & IT',
  'Online Audio and Video Media':                   'Software & IT',
  'Online Media':                                   'Software & IT',
  'Business Intelligence Platforms':                'Software & IT',
  'Climate Data and Analytics':                     'Software & IT',
  'Nanotechnology Research':                        'Software & IT',
  'Space Research and Technology':                  'Software & IT',

  // Financial Services
  'Accounting':                                     'Financial Services',
  'Banking':                                        'Financial Services',
  'Capital Markets':                                'Financial Services',
  'Financial Services':                             'Financial Services',
  'Insurance':                                      'Financial Services',
  'Insurance and Employee Benefit Funds':           'Financial Services',
  'Investment Advice':                              'Financial Services',
  'Investment Banking':                             'Financial Services',
  'Investment Management':                          'Financial Services',
  'Venture Capital and Private Equity Principals':  'Financial Services',
  'Fundraising':                                    'Financial Services',
  'Philanthropic Fundraising Services':             'Financial Services',

  // Healthcare & Life Sciences
  'Biotechnology':                                  'Healthcare & Life Sciences',
  'Biotechnology Research':                         'Healthcare & Life Sciences',
  'Health and Human Services':                      'Healthcare & Life Sciences',
  'Health, Wellness and Fitness':                   'Healthcare & Life Sciences',
  'Home Health Care Services':                      'Healthcare & Life Sciences',
  'Hospitals and Health Care':                      'Healthcare & Life Sciences',
  'Medical and Diagnostic Laboratories':            'Healthcare & Life Sciences',
  'Medical Devices':                                'Healthcare & Life Sciences',
  'Medical Equipment Manufacturing':                'Healthcare & Life Sciences',
  'Medical Practices':                              'Healthcare & Life Sciences',
  'Mental Health Care':                             'Healthcare & Life Sciences',
  'Pharmaceutical Manufacturing':                   'Healthcare & Life Sciences',
  'Public Health':                                  'Healthcare & Life Sciences',
  'Wellness and Fitness Services':                  'Healthcare & Life Sciences',
  'Individual and Family Services':                 'Healthcare & Life Sciences',

  // Climate & Energy
  'Air, Water, and Waste Program Management':               'Climate & Energy',
  'Climate Technology Product Manufacturing':               'Climate & Energy',
  'Electric Power Generation':                             'Climate & Energy',
  'Electric Power Transmission, Control, and Distribution': 'Climate & Energy',
  'Energy Technology':                                     'Climate & Energy',
  'Environmental Services':                                'Climate & Energy',
  'Nuclear Electric Power Generation':                     'Climate & Energy',
  'Oil and Gas':                                           'Climate & Energy',
  'Oil, Gas, and Mining':                                  'Climate & Energy',
  'Renewable Energy Equipment Manufacturing':              'Climate & Energy',
  'Renewable Energy Power Generation':                     'Climate & Energy',
  'Renewable Energy Semiconductor Manufacturing':          'Climate & Energy',
  'Renewables & Environment':                              'Climate & Energy',
  'Services for Renewable Energy':                         'Climate & Energy',
  'Solar Electric Power Generation':                       'Climate & Energy',
  'Wind Electric Power Generation':                        'Climate & Energy',
  'Water Supply and Irrigation Systems':                   'Climate & Energy',
  'Mining':                                                'Climate & Energy',

  // Media & Entertainment
  'Animation':                                      'Media & Entertainment',
  'Animation and Post-production':                  'Media & Entertainment',
  'Broadcast Media Production and Distribution':    'Media & Entertainment',
  'Business Content':                               'Media & Entertainment',
  'Entertainment':                                  'Media & Entertainment',
  'Entertainment Providers':                        'Media & Entertainment',
  'Media & Telecommunications':                     'Media & Entertainment',
  'Media Production':                               'Media & Entertainment',
  'Movies, Videos and Sound':                       'Media & Entertainment',
  'Music':                                          'Media & Entertainment',
  'Musicians':                                      'Media & Entertainment',
  'Newspaper Publishing':                           'Media & Entertainment',
  'Periodical Publishing':                          'Media & Entertainment',
  'Book Publishing':                                'Media & Entertainment',
  'Book and Periodical Publishing':                 'Media & Entertainment',
  'Photography':                                    'Media & Entertainment',
  'Writing and Editing':                            'Media & Entertainment',
  'Artists and Writers':                            'Media & Entertainment',
  'Arts and Crafts':                                'Media & Entertainment',
  'Design':                                         'Media & Entertainment',
  'Design Services':                                'Media & Entertainment',
  'Graphic Design':                                 'Media & Entertainment',
  'Interior Design':                                'Media & Entertainment',
  'Spectator Sports':                               'Media & Entertainment',
  'Museums, Historical Sites, and Zoos':            'Media & Entertainment',

  // Consumer & Retail
  'Apparel and Fashion':                            'Consumer & Retail',
  'Consumer Electronics':                           'Consumer & Retail',
  'Consumer Goods':                                 'Consumer & Retail',
  'Consumer Services':                              'Consumer & Retail',
  'Cosmetics':                                      'Consumer & Retail',
  'Food & Beverages':                               'Consumer & Retail',
  'Food and Beverage Manufacturing':                'Consumer & Retail',
  'Food and Beverage Retail':                       'Consumer & Retail',
  'Food and Beverage Services':                     'Consumer & Retail',
  'Food Production':                                'Consumer & Retail',
  'Furniture':                                      'Consumer & Retail',
  'Furniture and Home Furnishings Manufacturing':   'Consumer & Retail',
  'Luxury Goods and Jewelry':                       'Consumer & Retail',
  'Personal Care Product Manufacturing':            'Consumer & Retail',
  'Personal Care Services':                         'Consumer & Retail',
  'Pet Services':                                   'Consumer & Retail',
  'Restaurants':                                    'Consumer & Retail',
  'Retail':                                         'Consumer & Retail',
  'Retail Apparel and Fashion':                     'Consumer & Retail',
  'Retail Appliances, Electrical, and Electronic Equipment': 'Consumer & Retail',
  'Retail Art Supplies':                            'Consumer & Retail',
  'Retail Building Materials and Garden Equipment': 'Consumer & Retail',
  'Retail Groceries':                               'Consumer & Retail',
  'Retail Health and Personal Care Products':       'Consumer & Retail',
  'Retail Luxury Goods and Jewelry':                'Consumer & Retail',
  'Retail Motor Vehicles':                          'Consumer & Retail',
  'Sporting Goods':                                 'Consumer & Retail',
  'Sporting Goods Manufacturing':                   'Consumer & Retail',
  'Wine and Spirits':                               'Consumer & Retail',
  'Beverage Manufacturing':                         'Consumer & Retail',
  'Dairy Product Manufacturing':                    'Consumer & Retail',
  'Leisure, Travel & Tourism':                      'Consumer & Retail',
  'Hotels and Motels':                              'Consumer & Retail',
  'Hospitality':                                    'Consumer & Retail',
  'Travel Arrangements':                            'Consumer & Retail',
  'Gambling Facilities and Casinos':                'Consumer & Retail',
  'Sports and Recreation Instruction':              'Consumer & Retail',

  // Business Services
  'Advertising Services':                           'Business Services',
  'Business Consulting and Services':               'Business Services',
  'Engineering Services':                           'Business Services',
  'Events Services':                                'Business Services',
  'Executive Search Services':                      'Business Services',
  'Facilities Services':                            'Business Services',
  'Government Relations Services':                  'Business Services',
  'Human Resources':                                'Business Services',
  'Human Resources Services':                       'Business Services',
  'Law Practice':                                   'Business Services',
  'Legal Services':                                 'Business Services',
  'Market Research':                                'Business Services',
  'Marketing Services':                             'Business Services',
  'Mechanical or Industrial Engineering':           'Business Services',
  'Outsourcing and Offshoring Consulting':          'Business Services',
  'Outsourcing/Offshoring':                         'Business Services',
  'Professional Training and Coaching':             'Business Services',
  'Public Relations and Communications Services':   'Business Services',
  'Research':                                       'Business Services',
  'Research Services':                              'Business Services',
  'Security and Investigations':                    'Business Services',
  'Security Systems Services':                      'Business Services',
  'Staffing and Recruiting':                        'Business Services',
  'Strategic Management Services':                  'Business Services',
  'Technical and Vocational Training':              'Business Services',
  'Translation and Localization':                   'Business Services',
  'Administrative and Support Services':            'Business Services',
  'Program Development':                            'Business Services',
  'Repair and Maintenance':                         'Business Services',
  'Printing Services':                              'Business Services',
  'Laundry and Drycleaning Services':               'Business Services',
  'Equipment Rental Services':                      'Business Services',

  // Education & Nonprofits
  'E-Learning':                                     'Education & Nonprofits',
  'E-Learning Providers':                           'Education & Nonprofits',
  'Education':                                      'Education & Nonprofits',
  'Education Administration Programs':              'Education & Nonprofits',
  'Education Management':                           'Education & Nonprofits',
  'Higher Education':                               'Education & Nonprofits',
  'Primary and Secondary Education':                'Education & Nonprofits',
  'Non-profit Organization Management':             'Education & Nonprofits',
  'Non-profit Organizations':                       'Education & Nonprofits',
  'Philanthropy':                                   'Education & Nonprofits',
  'Civic and Social Organizations':                 'Education & Nonprofits',
  'Public Policy':                                  'Education & Nonprofits',
  'Public Policy Offices':                          'Education & Nonprofits',
  'Think Tanks':                                    'Education & Nonprofits',
  'Public Safety':                                  'Education & Nonprofits',
  'Armed Forces':                                   'Education & Nonprofits',
  'International Affairs':                          'Education & Nonprofits',
  'International Trade and Development':            'Education & Nonprofits',
  'Executive Offices':                              'Education & Nonprofits',
  'Industry Associations':                          'Education & Nonprofits',
  'Professional Organizations':                     'Education & Nonprofits',

  // Industrial & Manufacturing
  'Agriculture, Construction, Mining Machinery Manufacturing': 'Industrial & Manufacturing',
  'Appliances, Electrical, and Electronics Manufacturing':     'Industrial & Manufacturing',
  'Architecture and Planning':                                 'Industrial & Manufacturing',
  'Automotive':                                               'Industrial & Manufacturing',
  'Chemical Manufacturing':                                   'Industrial & Manufacturing',
  'Chemical Raw Materials Manufacturing':                     'Industrial & Manufacturing',
  'Civil Engineering':                                        'Industrial & Manufacturing',
  'Construction':                                             'Industrial & Manufacturing',
  'Defense & Space':                                          'Industrial & Manufacturing',
  'Defense and Space Manufacturing':                          'Industrial & Manufacturing',
  'Electric Lighting Equipment Manufacturing':                'Industrial & Manufacturing',
  'Electrical Equipment Manufacturing':                       'Industrial & Manufacturing',
  'Farming':                                                  'Industrial & Manufacturing',
  'Farming, Ranching, Forestry':                              'Industrial & Manufacturing',
  'Forestry and Logging':                                     'Industrial & Manufacturing',
  'HVAC and Refrigeration Equipment Manufacturing':           'Industrial & Manufacturing',
  'Industrial Machinery Manufacturing':                       'Industrial & Manufacturing',
  'Machinery Manufacturing':                                  'Industrial & Manufacturing',
  'Manufacturing':                                            'Industrial & Manufacturing',
  'Motor Vehicle Manufacturing':                              'Industrial & Manufacturing',
  'Motor Vehicle Parts Manufacturing':                        'Industrial & Manufacturing',
  'Packaging and Containers':                                 'Industrial & Manufacturing',
  'Packaging and Containers Manufacturing':                   'Industrial & Manufacturing',
  'Paper and Forest Product Manufacturing':                   'Industrial & Manufacturing',
  'Paper and Forest Products':                                'Industrial & Manufacturing',
  'Plastics Manufacturing':                                   'Industrial & Manufacturing',
  'Residential Building Construction':                        'Industrial & Manufacturing',
  'Soap and Cleaning Product Manufacturing':                  'Industrial & Manufacturing',
  'Textile Manufacturing':                                    'Industrial & Manufacturing',
  'Wholesale':                                                'Industrial & Manufacturing',
  'Wholesale Building Materials':                             'Industrial & Manufacturing',
  'Wholesale Food and Beverage':                              'Industrial & Manufacturing',
  'Wholesale Import and Export':                              'Industrial & Manufacturing',
  'Wholesale Recyclable Materials':                           'Industrial & Manufacturing',
  'Import and Export':                                        'Industrial & Manufacturing',

  // Logistics & Transportation
  'Airlines and Aviation':                                    'Logistics & Transportation',
  'Aviation & Aerospace':                                     'Logistics & Transportation',
  'Aviation and Aerospace Component Manufacturing':           'Logistics & Transportation',
  'Ground Passenger Transportation':                          'Logistics & Transportation',
  'Maritime Transportation':                                  'Logistics & Transportation',
  'Rail Transportation':                                      'Logistics & Transportation',
  'Transportation Programs':                                  'Logistics & Transportation',
  'Transportation, Logistics, Supply Chain and Storage':      'Logistics & Transportation',
  'Transportation/Trucking/Railroad':                         'Logistics & Transportation',
  'Truck Transportation':                                     'Logistics & Transportation',
  'Urban Transit Services':                                   'Logistics & Transportation',
  'Warehousing and Storage':                                  'Logistics & Transportation',
  'Wireless Services':                                        'Logistics & Transportation',
  'Telecommunications':                                       'Logistics & Transportation',
  'Telecommunications Carriers':                              'Logistics & Transportation',
}

const CATEGORY_ORDER = [
  'Software & IT',
  'Financial Services',
  'Healthcare & Life Sciences',
  'Climate & Energy',
  'Media & Entertainment',
  'Consumer & Retail',
  'Business Services',
  'Education & Nonprofits',
  'Industrial & Manufacturing',
  'Logistics & Transportation',
]

const CATEGORY_COLORS: Record<string, string> = {
  'Software & IT':            'text-blue-400   border-blue-400/30   hover:border-blue-400/70   hover:text-blue-300',
  'Financial Services':       'text-terrain-gold border-terrain-goldBorder/30 hover:border-terrain-goldBorder hover:text-terrain-gold',
  'Healthcare & Life Sciences':'text-emerald-400 border-emerald-400/30 hover:border-emerald-400/70 hover:text-emerald-300',
  'Climate & Energy':         'text-green-400   border-green-400/30   hover:border-green-400/70   hover:text-green-300',
  'Media & Entertainment':    'text-purple-400  border-purple-400/30  hover:border-purple-400/70  hover:text-purple-300',
  'Consumer & Retail':        'text-pink-400    border-pink-400/30    hover:border-pink-400/70    hover:text-pink-300',
  'Business Services':        'text-orange-400  border-orange-400/30  hover:border-orange-400/70  hover:text-orange-300',
  'Education & Nonprofits':   'text-cyan-400    border-cyan-400/30    hover:border-cyan-400/70    hover:text-cyan-300',
  'Industrial & Manufacturing':'text-stone-400  border-stone-400/30   hover:border-stone-400/70   hover:text-stone-300',
  'Logistics & Transportation':'text-sky-400    border-sky-400/30     hover:border-sky-400/70     hover:text-sky-300',
  'Other':                    'text-terrain-muted border-terrain-border hover:border-terrain-subtle hover:text-terrain-text',
}

// ─── Custom search field options (Clay-style) ────────────────────────────────

const FUNDING_STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B']
const HEADCOUNT_RANGES = ['1–10', '11–50', '51–200', '201–500', '500+']
const LOCATIONS = ['Los Angeles', 'New York', 'San Francisco', 'Austin', 'Miami', 'Chicago', 'United States', 'Latin America']

function buildCustomQuery(fields: CustomFields): string {
  const parts: string[] = []
  if (fields.vertical)   parts.push(fields.vertical)
  if (fields.stage.length)     parts.push(`${fields.stage.join(' or ')} stage`)
  if (fields.location)   parts.push(`in ${fields.location}`)
  if (fields.headcount.length) parts.push(`${fields.headcount.join(' or ')} employees`)
  if (fields.keywords)   parts.push(fields.keywords)
  return parts.join(', ')
}

interface CustomFields {
  vertical:  string
  stage:     string[]
  location:  string
  headcount: string[]
  keywords:  string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchBar({ onSearch, isLoading, industries = [], searchMode = 'market', onModeChange }: Props) {
  const [query,      setQuery]      = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Custom search state
  const [custom, setCustom] = useState<CustomFields>({
    vertical: '', stage: [], location: '', headcount: [], keywords: '',
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isLoading) return
    if (searchMode === 'custom') {
      const q = buildCustomQuery(custom).trim()
      if (q) onSearch(q)
    } else {
      const q = query.trim()
      if (q) onSearch(q)
    }
  }

  function handleChip(industry: string) {
    if (isLoading) return
    setQuery(industry)
    onSearch(industry)
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function toggleCustomChip(field: 'stage' | 'headcount', value: string) {
    setCustom(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value],
    }))
  }

  const customIsValid = buildCustomQuery(custom).trim().length > 0

  // Group DB industries by Clay category
  const grouped: Record<string, string[]> = {}
  for (const industry of industries) {
    const cat = CATEGORY_MAP[industry] ?? 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(industry)
  }

  const orderedCategories = [
    ...CATEGORY_ORDER.filter(c => grouped[c]?.length),
    ...(grouped['Other']?.length ? ['Other'] : []),
  ]

  const PREVIEW_COUNT = 4

  const MODES: Array<{ key: SearchMode; icon: string; label: string }> = [
    { key: 'market',  icon: '⬡', label: 'Sector Map'     },
    { key: 'company', icon: '◎', label: 'Company Lookup' },
    { key: 'custom',  icon: '⊕', label: 'Custom Search'  },
  ]

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

      {/* ── Custom search form ── */}
      {searchMode === 'custom' ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-lg border border-terrain-border bg-terrain-surface p-5 flex flex-col gap-4">

            {/* Vertical */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                Vertical / Industry
              </label>
              <input
                value={custom.vertical}
                onChange={e => setCustom(p => ({ ...p, vertical: e.target.value }))}
                placeholder="e.g. B2B SaaS, Vertical SaaS, Construction Tech, HealthTech…"
                className="w-full bg-terrain-bg border border-terrain-border rounded px-4 py-2.5 text-terrain-text text-sm font-mono placeholder-terrain-muted/50 focus:outline-none focus:border-terrain-gold transition-colors"
              />
            </div>

            {/* Funding Stage */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                Funding Stage
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {FUNDING_STAGES.map(s => (
                  <button
                    key={s} type="button"
                    onClick={() => toggleCustomChip('stage', s)}
                    className={`text-[11px] font-mono border px-3 py-1 rounded transition-colors ${
                      custom.stage.includes(s)
                        ? 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold'
                        : 'border-terrain-border text-terrain-muted hover:border-terrain-subtle hover:text-terrain-text'
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* HQ Location */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                  HQ Location
                </label>
                <input
                  list="location-list"
                  value={custom.location}
                  onChange={e => setCustom(p => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Los Angeles, US…"
                  className="w-full bg-terrain-bg border border-terrain-border rounded px-3 py-2 text-terrain-text text-sm font-mono placeholder-terrain-muted/50 focus:outline-none focus:border-terrain-gold transition-colors"
                />
                <datalist id="location-list">
                  {LOCATIONS.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>

              {/* Headcount */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                  Headcount
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {HEADCOUNT_RANGES.map(h => (
                    <button
                      key={h} type="button"
                      onClick={() => toggleCustomChip('headcount', h)}
                      className={`text-[10px] font-mono border px-2.5 py-1 rounded transition-colors ${
                        custom.headcount.includes(h)
                          ? 'bg-terrain-goldDim border-terrain-goldBorder text-terrain-gold'
                          : 'border-terrain-border text-terrain-muted hover:border-terrain-subtle hover:text-terrain-text'
                      }`}
                    >{h}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Keywords / Thesis */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-terrain-muted mb-1.5 block">
                Keywords / Investment Thesis
              </label>
              <input
                value={custom.keywords}
                onChange={e => setCustom(p => ({ ...p, keywords: e.target.value }))}
                placeholder="e.g. workflow automation for field service, strong traction, operator founder…"
                className="w-full bg-terrain-bg border border-terrain-border rounded px-4 py-2.5 text-terrain-text text-sm font-mono placeholder-terrain-muted/50 focus:outline-none focus:border-terrain-gold transition-colors"
              />
            </div>

            {/* Preview + Submit */}
            {customIsValid && (
              <p className="text-[10px] font-mono text-terrain-muted/60 italic">
                Search: "{buildCustomQuery(custom)}"
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !customIsValid}
              className="w-full py-3 bg-terrain-gold text-terrain-bg text-xs font-bold rounded tracking-widest uppercase hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isLoading ? '···' : '⊕ Run Web Search →'}
            </button>
          </div>
        </form>

      ) : (
        /* ── Standard search bar ── */
        <form onSubmit={handleSubmit} className="relative">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={isLoading}
            placeholder={
              searchMode === 'company'
                ? 'Company domain, name, or LinkedIn URL…'
                : 'Enter a vertical or sector (e.g. Construction SaaS, HealthTech, Fintech)…'
            }
            className="w-full bg-terrain-surface border border-terrain-border rounded-lg px-5 py-4 pr-28 text-terrain-text text-sm font-mono placeholder-terrain-muted focus:outline-none focus:border-terrain-gold transition-colors disabled:opacity-60"
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-terrain-gold text-terrain-bg text-xs font-bold rounded tracking-widest uppercase hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {isLoading ? '···' : searchMode === 'company' ? 'LOOKUP →' : 'MAP →'}
          </button>
        </form>
      )}

      {/* ── Industry chips (Sector Map mode only) ── */}
      {orderedCategories.length > 0 && searchMode === 'market' && (
        <div className="mt-6 space-y-3">
          {orderedCategories.map(cat => {
            const items     = grouped[cat] ?? []
            const isExpanded = expandedCategories.has(cat)
            const visible   = isExpanded ? items : items.slice(0, PREVIEW_COUNT)
            const colorClass = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other']

            return (
              <div key={cat} className="flex items-start gap-3">
                <span className={`text-[9px] font-mono uppercase tracking-widest shrink-0 w-28 pt-1.5 text-right ${colorClass.split(' ')[0]}`}>
                  {cat}
                </span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {visible.map(industry => (
                    <button
                      key={industry}
                      onClick={() => handleChip(industry)}
                      disabled={isLoading}
                      className={`text-[11px] font-mono border px-2.5 py-1 rounded transition-colors disabled:opacity-40 ${colorClass}`}
                    >
                      {industry}
                    </button>
                  ))}
                  {items.length > PREVIEW_COUNT && (
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="text-[11px] font-mono text-terrain-muted hover:text-terrain-text transition-colors px-2 py-1"
                    >
                      {isExpanded ? '− less' : `+${items.length - PREVIEW_COUNT} more`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
