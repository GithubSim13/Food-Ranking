import { useMemo } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'
import { BoltIcon } from '../common/Icons'
import { sortReviewsByDateDesc } from '../../utils'

function ChartBarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

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

  const { entryCount, restaurantCount, starredCount, unratedCount } = useMemo(() => ({
    entryCount: entries.length,
    restaurantCount: new Set(entries.map(e => e.restaurantId)).size,
    starredCount: entries.filter(e => e.starred).length,
    unratedCount: entries.filter(e => {
      if (e.reviews.length === 0) return false
      const latest = sortReviewsByDateDesc(e.reviews)[0]
      return latest.rating1 === null && latest.rating2 === null && latest.rating3 === null
    }).length,
  }), [entries])

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
        <NavLink to="/rate" style={navLinkStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BoltIcon />
            Rate
            {unratedCount > 0 && (
              <span style={{
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                fontSize: '0.65rem',
                borderRadius: 999,
                padding: '1px 6px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                flexShrink: 0,
                lineHeight: 1.4,
              }}>
                {unratedCount}
              </span>
            )}
          </span>
        </NavLink>

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
        <NavLink to="/analytics" style={navLinkStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ChartBarIcon />
            Analytics
          </span>
        </NavLink>

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
              <span style={{ display: 'block' }}>est. 2025</span>
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
