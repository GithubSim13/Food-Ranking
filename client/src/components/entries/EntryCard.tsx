import { useNavigate } from 'react-router-dom'
import type { Entry } from '../../types'

function avgOverallRating(reviews: { overallRating: number | null }[]) {
  const ratings = reviews.map(r => r.overallRating).filter((r): r is number => r !== null)
  if (!ratings.length) return null
  return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
}

export default function EntryCard({ entry }: { entry: Entry }) {
  const navigate = useNavigate()
  const avg = avgOverallRating(entry.reviews)

  return (
    <div
      onClick={() => navigate(`/entries/${entry.id}`)}
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '0.875rem 1rem',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
          {entry.foodName}
          {entry.starred && <span title="Worth trying once in a lifetime">⭐</span>}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.2rem' }}>
          {entry.category} · {entry.restaurant.name}
        </div>
      </div>
      {avg && (
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#2563eb', flexShrink: 0 }}>
          {avg}
        </span>
      )}
    </div>
  )
}
