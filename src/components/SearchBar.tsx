import { useState, FormEvent } from 'react'

interface Props {
  onSearch: (query: string) => void
  isLoading: boolean
  industries?: string[]
}

// Map each industry string to a category
const CATEGORY_MAP: Record<string, string> = {
  // Technology
  'Software Development': 'Technology',
  'IT Services and IT Consulting': 'Technology',
  'Technology, Information and Internet': 'Technology',
  'Technology, Information and Media': 'Technology',
  'Information Technology and Services': 'Technology',
  'Information Services': 'Technology',
  'Computer and Network Security': 'Technology',
  'Computer Hardware': 'Technology',
  'Computer Hardware Manufacturing': 'Technology',
  'Computer Networking': 'Technology',
  'Computer Networking Products': 'Technology',
  'Computers and Electronics Manufacturing': 'Technology',
  'Data Infrastructure and Analytics': 'Technology',
  'Data Security Software Products': 'Technology',
  'Desktop Computing Software Products': 'Technology',
  'Embedded Software Products': 'Technology',
  'IT System Custom Software Development': 'Technology',
  'IT System Data Services': 'Technology',
  'IT System Training and Support': 'Technology',
  'Mobile Computing Software Products': 'Technology',
  'Semiconductor Manufacturing': 'Technology',
  'Semiconductors': 'Technology',
  'Automation Machinery Manufacturing': 'Technology',
  'Industrial Automation': 'Technology',
  'Robotics Engineering': 'Technology',
  'Robot Manufacturing': 'Technology',
  'Blockchain Services': 'Technology',
  'Computer Games': 'Technology',
  'Mobile Gaming Apps': 'Technology',
  'Social Networking Platforms': 'Technology',
  'Internet Marketplace Platforms': 'Technology',
  'Internet News': 'Technology',
  'Internet Publishing': 'Technology',
  'Online Audio and Video Media': 'Technology',
  'Online Media': 'Technology',
  'Business Intelligence Platforms': 'Technology',
  'Climate Data and Analytics': 'Technology',
  'Nanotechnology Research': 'Technology',
  'Space Research and Technology': 'Technology',

  // Finance
  'Accounting': 'Finance',
  'Banking': 'Finance',
  'Capital Markets': 'Finance',
  'Financial Services': 'Finance',
  'Insurance': 'Finance',
  'Insurance and Employee Benefit Funds': 'Finance',
  'Investment Advice': 'Finance',
  'Investment Banking': 'Finance',
  'Investment Management': 'Finance',
  'Venture Capital and Private Equity Principals': 'Finance',
  'Fundraising': 'Finance',
  'Philanthropic Fundraising Services': 'Finance',

  // Healthcare
  'Biotechnology': 'Healthcare',
  'Biotechnology Research': 'Healthcare',
  'Health and Human Services': 'Healthcare',
  'Health, Wellness and Fitness': 'Healthcare',
  'Home Health Care Services': 'Healthcare',
  'Hospitals and Health Care': 'Healthcare',
  'Medical and Diagnostic Laboratories': 'Healthcare',
  'Medical Devices': 'Healthcare',
  'Medical Equipment Manufacturing': 'Healthcare',
  'Medical Practices': 'Healthcare',
  'Mental Health Care': 'Healthcare',
  'Pharmaceutical Manufacturing': 'Healthcare',
  'Public Health': 'Healthcare',
  'Wellness and Fitness Services': 'Healthcare',
  'Individual and Family Services': 'Healthcare',

  // Energy & Climate
  'Air, Water, and Waste Program Management': 'Energy & Climate',
  'Climate Technology Product Manufacturing': 'Energy & Climate',
  'Electric Power Generation': 'Energy & Climate',
  'Electric Power Transmission, Control, and Distribution': 'Energy & Climate',
  'Energy Technology': 'Energy & Climate',
  'Environmental Services': 'Energy & Climate',
  'Nuclear Electric Power Generation': 'Energy & Climate',
  'Oil and Gas': 'Energy & Climate',
  'Oil, Gas, and Mining': 'Energy & Climate',
  'Renewable Energy Equipment Manufacturing': 'Energy & Climate',
  'Renewable Energy Power Generation': 'Energy & Climate',
  'Renewable Energy Semiconductor Manufacturing': 'Energy & Climate',
  'Renewables & Environment': 'Energy & Climate',
  'Services for Renewable Energy': 'Energy & Climate',
  'Solar Electric Power Generation': 'Energy & Climate',
  'Wind Electric Power Generation': 'Energy & Climate',
  'Water Supply and Irrigation Systems': 'Energy & Climate',
  'Mining': 'Energy & Climate',

  // Media & Creative
  'Animation': 'Media & Creative',
  'Animation and Post-production': 'Media & Creative',
  'Broadcast Media Production and Distribution': 'Media & Creative',
  'Business Content': 'Media & Creative',
  'Entertainment': 'Media & Creative',
  'Entertainment Providers': 'Media & Creative',
  'Media & Telecommunications': 'Media & Creative',
  'Media Production': 'Media & Creative',
  'Movies, Videos and Sound': 'Media & Creative',
  'Music': 'Media & Creative',
  'Musicians': 'Media & Creative',
  'Newspaper Publishing': 'Media & Creative',
  'Periodical Publishing': 'Media & Creative',
  'Book Publishing': 'Media & Creative',
  'Book and Periodical Publishing': 'Media & Creative',
  'Photography': 'Media & Creative',
  'Writing and Editing': 'Media & Creative',
  'Artists and Writers': 'Media & Creative',
  'Arts and Crafts': 'Media & Creative',
  'Design': 'Media & Creative',
  'Design Services': 'Media & Creative',
  'Graphic Design': 'Media & Creative',
  'Interior Design': 'Media & Creative',
  'Spectator Sports': 'Media & Creative',
  'Museums, Historical Sites, and Zoos': 'Media & Creative',

  // Consumer & Retail
  'Apparel and Fashion': 'Consumer & Retail',
  'Consumer Electronics': 'Consumer & Retail',
  'Consumer Goods': 'Consumer & Retail',
  'Consumer Services': 'Consumer & Retail',
  'Cosmetics': 'Consumer & Retail',
  'Food & Beverages': 'Consumer & Retail',
  'Food and Beverage Manufacturing': 'Consumer & Retail',
  'Food and Beverage Retail': 'Consumer & Retail',
  'Food and Beverage Services': 'Consumer & Retail',
  'Food Production': 'Consumer & Retail',
  'Furniture': 'Consumer & Retail',
  'Furniture and Home Furnishings Manufacturing': 'Consumer & Retail',
  'Luxury Goods and Jewelry': 'Consumer & Retail',
  'Personal Care Product Manufacturing': 'Consumer & Retail',
  'Personal Care Services': 'Consumer & Retail',
  'Pet Services': 'Consumer & Retail',
  'Restaurants': 'Consumer & Retail',
  'Retail': 'Consumer & Retail',
  'Retail Apparel and Fashion': 'Consumer & Retail',
  'Retail Appliances, Electrical, and Electronic Equipment': 'Consumer & Retail',
  'Retail Art Supplies': 'Consumer & Retail',
  'Retail Building Materials and Garden Equipment': 'Consumer & Retail',
  'Retail Groceries': 'Consumer & Retail',
  'Retail Health and Personal Care Products': 'Consumer & Retail',
  'Retail Luxury Goods and Jewelry': 'Consumer & Retail',
  'Retail Motor Vehicles': 'Consumer & Retail',
  'Sporting Goods': 'Consumer & Retail',
  'Sporting Goods Manufacturing': 'Consumer & Retail',
  'Wine and Spirits': 'Consumer & Retail',
  'Beverage Manufacturing': 'Consumer & Retail',
  'Dairy Product Manufacturing': 'Consumer & Retail',
  'Leisure, Travel & Tourism': 'Consumer & Retail',
  'Hotels and Motels': 'Consumer & Retail',
  'Hospitality': 'Consumer & Retail',
  'Travel Arrangements': 'Consumer & Retail',
  'Gambling Facilities and Casinos': 'Consumer & Retail',
  'Sports and Recreation Instruction': 'Consumer & Retail',

  // Professional Services
  'Advertising Services': 'Professional Services',
  'Business Consulting and Services': 'Professional Services',
  'Engineering Services': 'Professional Services',
  'Events Services': 'Professional Services',
  'Executive Search Services': 'Professional Services',
  'Facilities Services': 'Professional Services',
  'Government Relations Services': 'Professional Services',
  'Human Resources': 'Professional Services',
  'Human Resources Services': 'Professional Services',
  'Law Practice': 'Professional Services',
  'Legal Services': 'Professional Services',
  'Market Research': 'Professional Services',
  'Marketing Services': 'Professional Services',
  'Mechanical or Industrial Engineering': 'Professional Services',
  'Outsourcing and Offshoring Consulting': 'Professional Services',
  'Outsourcing/Offshoring': 'Professional Services',
  'Professional Training and Coaching': 'Professional Services',
  'Public Relations and Communications Services': 'Professional Services',
  'Research': 'Professional Services',
  'Research Services': 'Professional Services',
  'Security and Investigations': 'Professional Services',
  'Security Systems Services': 'Professional Services',
  'Staffing and Recruiting': 'Professional Services',
  'Strategic Management Services': 'Professional Services',
  'Technical and Vocational Training': 'Professional Services',
  'Translation and Localization': 'Professional Services',
  'Administrative and Support Services': 'Professional Services',
  'Program Development': 'Professional Services',
  'Repair and Maintenance': 'Professional Services',
  'Printing Services': 'Professional Services',
  'Laundry and Drycleaning Services': 'Professional Services',
  'Equipment Rental Services': 'Professional Services',

  // Education & Social
  'E-Learning': 'Education & Social',
  'E-Learning Providers': 'Education & Social',
  'Education': 'Education & Social',
  'Education Administration Programs': 'Education & Social',
  'Education Management': 'Education & Social',
  'Higher Education': 'Education & Social',
  'Primary and Secondary Education': 'Education & Social',
  'Non-profit Organization Management': 'Education & Social',
  'Non-profit Organizations': 'Education & Social',
  'Philanthropy': 'Education & Social',
  'Civic and Social Organizations': 'Education & Social',
  'Public Policy': 'Education & Social',
  'Public Policy Offices': 'Education & Social',
  'Think Tanks': 'Education & Social',
  'Public Safety': 'Education & Social',
  'Armed Forces': 'Education & Social',
  'International Affairs': 'Education & Social',
  'International Trade and Development': 'Education & Social',
  'Executive Offices': 'Education & Social',
  'Industry Associations': 'Education & Social',
  'Professional Organizations': 'Education & Social',

  // Industrial & Manufacturing
  'Agriculture, Construction, Mining Machinery Manufacturing': 'Industrial',
  'Appliances, Electrical, and Electronics Manufacturing': 'Industrial',
  'Architecture and Planning': 'Industrial',
  'Automotive': 'Industrial',
  'Chemical Manufacturing': 'Industrial',
  'Chemical Raw Materials Manufacturing': 'Industrial',
  'Civil Engineering': 'Industrial',
  'Construction': 'Industrial',
  'Defense & Space': 'Industrial',
  'Defense and Space Manufacturing': 'Industrial',
  'Electric Lighting Equipment Manufacturing': 'Industrial',
  'Electrical Equipment Manufacturing': 'Industrial',
  'Farming': 'Industrial',
  'Farming, Ranching, Forestry': 'Industrial',
  'Forestry and Logging': 'Industrial',
  'HVAC and Refrigeration Equipment Manufacturing': 'Industrial',
  'Industrial Machinery Manufacturing': 'Industrial',
  'Machinery Manufacturing': 'Industrial',
  'Manufacturing': 'Industrial',
  'Motor Vehicle Manufacturing': 'Industrial',
  'Motor Vehicle Parts Manufacturing': 'Industrial',
  'Packaging and Containers': 'Industrial',
  'Packaging and Containers Manufacturing': 'Industrial',
  'Paper and Forest Product Manufacturing': 'Industrial',
  'Paper and Forest Products': 'Industrial',
  'Plastics Manufacturing': 'Industrial',
  'Residential Building Construction': 'Industrial',
  'Soap and Cleaning Product Manufacturing': 'Industrial',
  'Textile Manufacturing': 'Industrial',
  'Wholesale': 'Industrial',
  'Wholesale Building Materials': 'Industrial',
  'Wholesale Food and Beverage': 'Industrial',
  'Wholesale Import and Export': 'Industrial',
  'Wholesale Recyclable Materials': 'Industrial',
  'Import and Export': 'Industrial',

  // Transportation & Logistics
  'Airlines and Aviation': 'Transportation',
  'Aviation & Aerospace': 'Transportation',
  'Aviation and Aerospace Component Manufacturing': 'Transportation',
  'Ground Passenger Transportation': 'Transportation',
  'Maritime Transportation': 'Transportation',
  'Rail Transportation': 'Transportation',
  'Transportation Programs': 'Transportation',
  'Transportation, Logistics, Supply Chain and Storage': 'Transportation',
  'Transportation/Trucking/Railroad': 'Transportation',
  'Truck Transportation': 'Transportation',
  'Urban Transit Services': 'Transportation',
  'Warehousing and Storage': 'Transportation',
  'Wireless Services': 'Transportation',
  'Telecommunications': 'Transportation',
  'Telecommunications Carriers': 'Transportation',
}

const CATEGORY_ORDER = [
  'Technology',
  'Finance',
  'Healthcare',
  'Energy & Climate',
  'Media & Creative',
  'Consumer & Retail',
  'Professional Services',
  'Education & Social',
  'Industrial',
  'Transportation',
]

const CATEGORY_COLORS: Record<string, string> = {
  'Technology':          'text-blue-400   border-blue-400/30   hover:border-blue-400/70   hover:text-blue-300',
  'Finance':             'text-terrain-gold border-terrain-goldBorder/30 hover:border-terrain-goldBorder hover:text-terrain-gold',
  'Healthcare':          'text-emerald-400 border-emerald-400/30 hover:border-emerald-400/70 hover:text-emerald-300',
  'Energy & Climate':    'text-green-400   border-green-400/30   hover:border-green-400/70   hover:text-green-300',
  'Media & Creative':    'text-purple-400  border-purple-400/30  hover:border-purple-400/70  hover:text-purple-300',
  'Consumer & Retail':   'text-pink-400    border-pink-400/30    hover:border-pink-400/70    hover:text-pink-300',
  'Professional Services':'text-orange-400 border-orange-400/30  hover:border-orange-400/70  hover:text-orange-300',
  'Education & Social':  'text-cyan-400    border-cyan-400/30    hover:border-cyan-400/70    hover:text-cyan-300',
  'Industrial':          'text-stone-400   border-stone-400/30   hover:border-stone-400/70   hover:text-stone-300',
  'Transportation':      'text-sky-400     border-sky-400/30     hover:border-sky-400/70     hover:text-sky-300',
  'Other':               'text-terrain-muted border-terrain-border hover:border-terrain-subtle hover:text-terrain-text',
}

export default function SearchBar({ onSearch, isLoading, industries = [] }: Props) {
  const [query, setQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

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

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  // Group DB industries by category
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

  return (
    <div className="max-w-3xl mx-auto">
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

      {orderedCategories.length > 0 && (
        <div className="mt-6 space-y-3">
          {orderedCategories.map(cat => {
            const items = grouped[cat] ?? []
            const isExpanded = expandedCategories.has(cat)
            const visible = isExpanded ? items : items.slice(0, PREVIEW_COUNT)
            const colorClass = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other']

            return (
              <div key={cat} className="flex items-start gap-3">
                <span className={`text-[9px] font-mono uppercase tracking-widest shrink-0 w-24 pt-1.5 text-right ${colorClass.split(' ')[0]}`}>
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
