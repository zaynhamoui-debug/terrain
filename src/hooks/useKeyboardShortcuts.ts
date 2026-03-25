import { useEffect, useRef } from 'react'

interface Shortcuts {
  onSearch?:    () => void
  onClose?:     () => void
  onWatchlist?: () => void
  onCompare?:   () => void
  onHeatmap?:   () => void
  onExport?:    () => void
}

export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  const ref = useRef(shortcuts)
  ref.current = shortcuts

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case '/':        e.preventDefault(); ref.current.onSearch?.();    break
        case 'Escape':                       ref.current.onClose?.();     break
        case 'w': case 'W':                  ref.current.onWatchlist?.(); break
        case 'c': case 'C':                  ref.current.onCompare?.();   break
        case 'h': case 'H':                  ref.current.onHeatmap?.();   break
        case 'e': case 'E':                  ref.current.onExport?.();    break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
