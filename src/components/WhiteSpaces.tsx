interface Props {
  spaces: string[]
}

export default function WhiteSpaces({ spaces }: Props) {
  if (!spaces?.length) return null

  return (
    <div className="bg-terrain-surface border border-terrain-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-terrain-gold text-lg">◈</span>
        <h3 className="font-display text-base font-semibold text-terrain-text">
          White Spaces
        </h3>
        <span className="text-terrain-muted text-xs font-mono ml-auto">
          {spaces.length} opportunities
        </span>
      </div>
      <ol className="space-y-3">
        {spaces.map((space, i) => (
          <li key={i} className="flex gap-4">
            <span className="text-terrain-gold text-xs font-mono mt-0.5 shrink-0 w-5 text-right">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-terrain-text text-sm font-mono leading-relaxed">
              {space}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
