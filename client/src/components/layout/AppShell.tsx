import { Outlet, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'

function navLinkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: 'block',
    padding: '0.45rem 0.75rem',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--accent)' : 'var(--ink-mute)',
    background: isActive ? 'var(--accent-wash)' : 'transparent',
  }
}

export default function AppShell() {
  const { data: entries = [] } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  const entryCount = entries.length
  const restaurantCount = new Set(entries.map(e => e.restaurantId)).size
  const starredCount = entries.filter(e => e.starred).length
  const perEntryLatest = entries
    .map(e => {
      const sorted = [...e.reviews].map((r, i) => ({ r, i }))
        .sort((a, b) => {
          if (a.r.date && b.r.date) {
            const diff = new Date(b.r.date).getTime() - new Date(a.r.date).getTime()
            return diff !== 0 ? diff : b.i - a.i
          }
          if (a.r.date) return -1
          if (b.r.date) return 1
          return b.i - a.i
        })
      return sorted.find(({ r }) => r.overallRating !== null)?.r.overallRating ?? null
    })
    .filter((v): v is number => v !== null)
  const avgRating = perEntryLatest.length
    ? (perEntryLatest.reduce((a, b) => a + b, 0) / perEntryLatest.length).toFixed(1)
    : null

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <nav style={{
        width: 220,
        flexShrink: 0,
        padding: '1.25rem 0.875rem',
        borderRight: '1px solid var(--line)',
        background: 'var(--paper-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.125rem',
      }}>
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.5rem', padding: '0 0.25rem' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--accent-wash)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '1.1rem',
            color: 'var(--accent)',
            flexShrink: 0,
          }}>
            F
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink)' }}>
            Food Ranking
          </span>
        </div>

        {/* Primary nav */}
        <NavLink to="/" end style={navLinkStyle}>Home</NavLink>
        <NavLink to="/entries" style={navLinkStyle}>Entries</NavLink>
        <NavLink to="/rankings" style={navLinkStyle}>Rankings</NavLink>

        {/* Explore section */}
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--ink-mute)',
          padding: '0 0.75rem',
          marginTop: '1.25rem',
          marginBottom: '0.25rem',
          opacity: 0.6,
        }}>
          Explore
        </p>
        <NavLink to="/categories" style={navLinkStyle}>Categories</NavLink>
        <NavLink to="/restaurants" style={navLinkStyle}>Restaurants</NavLink>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer stats */}
        {entryCount > 0 && (
          <div style={{
            padding: '0.75rem',
            borderTop: '1px solid var(--line-soft)',
            marginTop: '0.5rem',
          }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', lineHeight: 1.6 }}>
              <span style={{ display: 'block' }}>{entryCount} lamons logged</span>
              <span style={{ display: 'block' }}>{restaurantCount} spots visited</span>
              <span style={{ display: 'block' }}>{starredCount} stand-out stars</span>
              {avgRating && (
                <span style={{ display: 'block' }}>est. 2025</span>
              )}
            </p>
          </div>
        )}
      </nav>

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto', background: 'var(--paper)' }}>
        <Outlet />
      </main>
    </div>
  )
}
