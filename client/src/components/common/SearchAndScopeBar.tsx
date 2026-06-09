import { useLayoutEffect, useRef } from 'react'

export type Scope = 'all' | 'starred' | 'abroad' | 'home' | 'tryAgain' | 'neverAgain' | 'uncertain'

export function pillStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? 'var(--accent-ink)' : 'var(--ink-mute)',
    border: active ? 'none' : '1px solid var(--line)',
    padding: '0.3rem 0.75rem',
    borderRadius: 20,
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: active ? 600 : 400,
  }
}

export function matchesScope(
  entry: { starred: boolean; flag: string | null; tryAgain?: boolean; neverAgain?: boolean; reviews?: { uncertainRating?: boolean }[] },
  scope: Scope,
): boolean {
  if (scope === 'starred') return entry.starred
  if (scope === 'abroad') return entry.flag !== null
  if (scope === 'home') return entry.flag === null
  if (scope === 'tryAgain') return entry.tryAgain === true
  if (scope === 'neverAgain') return entry.neverAgain === true
  if (scope === 'uncertain') return (entry.reviews ?? []).some(r => r.uncertainRating === true)
  return true
}

interface Props {
  search: string
  onSearchChange: (v: string) => void
  scope: Scope
  onScopeChange: (s: Scope) => void
  searchPlaceholder?: string
  extraScopePills?: { key: Scope; label: string }[]
  rightSlot?: React.ReactNode
  middleContent?: React.ReactNode
}

const SCOPE_PILLS: { key: Scope; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'starred', label: '★ Starred' },
  { key: 'abroad', label: 'Abroad' },
  { key: 'home', label: 'Home' },
]

export function SearchAndScopeBar({
  search,
  onSearchChange,
  scope,
  onScopeChange,
  searchPlaceholder = 'Search…',
  extraScopePills,
  rightSlot,
  middleContent,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => document.documentElement.style.setProperty('--search-bar-height', el.offsetHeight + 'px')
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={rootRef} style={{
      position: 'sticky',
      top: '-2rem',
      zIndex: 10,
      background: 'var(--paper)',
      paddingTop: '0.5rem',
      paddingBottom: '0.75rem',
      marginBottom: '0.75rem',
      borderBottom: '1px solid var(--line)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <input
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--line)',
          borderRadius: 8,
          marginBottom: '0.75rem',
          background: 'var(--surface)',
          color: 'var(--ink)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', justifyContent: (rightSlot && !middleContent) ? 'space-between' : undefined, alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {middleContent !== undefined ? middleContent : (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {SCOPE_PILLS.map(p => (
              <button key={p.key} onClick={() => onScopeChange(p.key)} style={pillStyle(scope === p.key)}>
                {p.label}
              </button>
            ))}
            {extraScopePills?.map(p => (
              <button key={p.key} onClick={() => onScopeChange(p.key)} style={pillStyle(scope === p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        {rightSlot}
      </div>
    </div>
  )
}
