import { useNavigate } from 'react-router-dom'
import type { Entry } from '../../types'

function avgOverallRating(reviews: { overallRating: number | null }[]) {
  const ratings = reviews.map(r => r.overallRating).filter((r): r is number => r !== null)
  if (!ratings.length) return null
  return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
}

export default function EntryCard({ entry }: { entry: Entry }) {
  const navigate = useNavigate()
  const avg = avgOverallRating(entry.reviews)

  return (
    <div
      onClick={() => navigate(`/entries/${entry.id}`)}
      style={{
        background: entry.starred ? '#FEF3C7' : '#fff',
        border: entry.starred ? '2px solid #F59E0B' : '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '0.875rem 1rem',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: entry.starred
          ? '0 0 0 3px #FDE68A, 0 4px 12px rgba(245, 158, 11, 0.25)'
          : 'none',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: entry.starred ? '#92400E' : undefined }}>
          {entry.foodName}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.2rem' }}>
          {entry.category} · {entry.restaurant.name}
        </div>
      </div>
      {avg && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700, fontSize: '1.1rem', color: '#2563eb', flexShrink: 0 }}>
          {entry.starred && <span style={{ fontSize: '0.9rem', color: '#F59E0B' }}>★</span>}
          {avg}
        </span>
      )}
    </div>
  )
}
