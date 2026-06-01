import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEntry } from '../../api/entries'
import ReviewForm from '../reviews/ReviewForm'

export default function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const entryId = Number(id)
  const queryClient = useQueryClient()

  const { data: entry, isLoading } = useQuery({
    queryKey: ['entries', entryId],
    queryFn: () => getEntry(entryId),
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>
  if (!entry) return <p style={{ color: '#6b7280' }}>Entry not found.</p>

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{entry.foodName}</h2>
          {entry.starred && <span title="Worth trying once in a lifetime">⭐</span>}
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          {entry.category} · {entry.restaurant.name}
        </p>
      </div>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Reviews</h3>
        {entry.reviews.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No reviews yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {entry.reviews.map(r => (
              <div key={r.id} style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0.875rem 1rem',
              }}>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                  {new Date(r.date).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.9rem' }}>
                  {r.rating1 != null && <span>Taste <strong>{r.rating1}</strong></span>}
                  {r.rating2 != null && <span>Value <strong>{r.rating2}</strong></span>}
                  {r.rating3 != null && <span>Consistency <strong>{r.rating3}</strong></span>}
                  {r.overallRating != null && (
                    <span style={{ color: '#2563eb' }}>Overall <strong>{r.overallRating}</strong></span>
                  )}
                </div>
                {r.notes && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#374151' }}>{r.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Add Review</h3>
        <ReviewForm
          entryId={entry.id}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['entries', entryId] })}
        />
      </section>
    </div>
  )
}
