import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'
import EntryCard from '../entries/EntryCard'

function avgRating(reviews: { overallRating: number | null }[]): number | null {
  const ratings = reviews.map(r => r.overallRating).filter((r): r is number => r !== null)
  return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
}

export default function StarredPage() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>

  const starred = entries.filter(e => e.starred)

  if (starred.length === 0) {
    return (
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Starred</h2>
        <p style={{ color: '#6b7280' }}>No starred entries yet. Star an entry to see it here.</p>
      </div>
    )
  }

  // Group by category
  const byCategory = starred.reduce<Record<string, typeof starred>>((acc, e) => {
    (acc[e.category] ??= []).push(e)
    return acc
  }, {})

  // Sort entries within each category: avg rating desc (nulls last), then foodName asc
  const categories = Object.keys(byCategory).sort()
  for (const cat of categories) {
    byCategory[cat].sort((a, b) => {
      const ra = avgRating(a.reviews)
      const rb = avgRating(b.reviews)
      if (ra !== null && rb !== null) return rb - ra
      if (ra !== null) return -1
      if (rb !== null) return 1
      return a.foodName.localeCompare(b.foodName)
    })
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Starred</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {categories.map(cat => (
          <section key={cat}>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#6b7280',
              marginBottom: '0.625rem',
            }}>
              {cat}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {byCategory[cat].map(entry => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
