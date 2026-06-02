import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRankings } from '../../api/rankings'
import FlagImage from '../common/FlagImage'

export default function RankingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: rankings, isLoading } = useQuery({
    queryKey: ['rankings'],
    queryFn: getRankings,
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>

  const categories = rankings ? Object.entries(rankings) : []

  if (categories.length === 0) {
    return (
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Rankings</h2>
        <p style={{ color: '#6b7280' }}>
          No rankings yet. Add reviews with an Overall Rating to see entries ranked here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Rankings</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {categories.map(([category, entries]) => (
          <section key={category}>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#6b7280',
              marginBottom: '0.625rem',
            }}>
              {category}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {entries.map((entry, i) => (
                <div
                  key={entry.id}
                  onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
                  style={{
                    background: entry.starred ? '#FEF3C7' : '#fff',
                    border: entry.starred ? '2px solid #F59E0B' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    boxShadow: entry.starred
                      ? '0 0 0 3px #FDE68A, 0 4px 12px rgba(245, 158, 11, 0.25)'
                      : 'none',
                  }}
                >
                  <span style={{ width: 24, textAlign: 'center', fontWeight: 700, color: '#9ca3af', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: entry.starred ? '#92400E' : undefined, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <FlagImage code={entry.flag} />
                      {entry.foodName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{entry.restaurant}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem', fontWeight: 700, fontSize: '1.1rem', color: entry.avgRating != null ? '#2563eb' : '#9ca3af' }}>
                      {entry.starred && entry.avgRating != null && <span style={{ fontSize: '0.9rem', color: '#F59E0B' }}>★</span>}
                      {entry.avgRating != null ? entry.avgRating.toFixed(2) : 'Unrated'}
                    </div>
                    {entry.reviewCount > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {entry.reviewCount} review{entry.reviewCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
