import { useNavigate, useLocation } from 'react-router-dom'
import type { Entry } from '../../types'
import FlagImage from '../common/FlagImage'

function latestRating(reviews: { overallRating: number | null; date: string | null }[]): string | null {
  const sorted = [...reviews].map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (a.r.date && b.r.date) {
        const diff = new Date(b.r.date).getTime() - new Date(a.r.date).getTime()
        return diff !== 0 ? diff : b.i - a.i
      }
      if (a.r.date) return -1
      if (b.r.date) return 1
      return b.i - a.i
    })
  const found = sorted.find(({ r }) => r.overallRating !== null)
  return found ? found.r.overallRating!.toFixed(2) : null
}

export default function EntryCard({ entry }: { entry: Entry }) {
  const navigate = useNavigate()
  const location = useLocation()
  const avg = latestRating(entry.reviews)

  return (
    <div
      onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
      style={{
        background: entry.starred ? 'var(--gold-wash)' : 'var(--surface)',
        border: entry.starred ? `1px solid var(--gold)` : '1px solid var(--line)',
        borderRadius: 14,
        padding: '0.875rem 1rem',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: entry.starred ? 'var(--gold)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <FlagImage code={entry.flag} />
          {entry.foodName}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--ink-mute)', marginTop: '0.2rem' }}>
          {entry.category} · {entry.restaurant.name}
        </div>
      </div>
      {avg && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)', flexShrink: 0 }}>
          {entry.starred && <span style={{ fontSize: '0.85rem', color: 'var(--gold)' }}>★</span>}
          {avg}
        </span>
      )}
    </div>
  )
}
