import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEntry } from '../../api/entries'
import { updateReview } from '../../api/reviews'
import ReviewForm from '../reviews/ReviewForm'
import type { Review } from '../../types'

const EDIT_RATING_FIELDS = [
  { label: 'Taste', key: 'rating1' },
  { label: 'Value', key: 'rating2' },
  { label: 'Consistency', key: 'rating3' },
] as const

interface ReviewCardProps {
  review: Review
  onUpdated: () => void
}

function ReviewCard({ review: r, onUpdated }: ReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({
    date: '',
    rating1: '',
    rating2: '',
    rating3: '',
    notes: '',
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateReview(r.id, {
        date: form.date || undefined,
        rating1: form.rating1 ? Number(form.rating1) : null,
        rating2: form.rating2 ? Number(form.rating2) : null,
        rating3: form.rating3 ? Number(form.rating3) : null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      setIsEditing(false)
      onUpdated()
    },
  })

  const startEdit = () => {
    setForm({
      date: r.date ? r.date.split('T')[0] : '',
      rating1: r.rating1?.toString() ?? '',
      rating2: r.rating2?.toString() ?? '',
      rating3: r.rating3?.toString() ?? '',
      notes: r.notes ?? '',
    })
    setIsEditing(true)
  }

  if (isEditing) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {EDIT_RATING_FIELDS.map(({ label, key }) => (
              <div key={key}>
                <label style={labelStyle}>{label} (1–10)</label>
                <input
                  type="number"
                  min={1} max={10} step={0.1}
                  placeholder="–"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => mutate()}
              disabled={isPending}
              style={{ ...saveBtnStyle, opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={isPending}
              style={{ ...cancelBtnStyle, opacity: isPending ? 0.6 : 1 }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          {r.date ? new Date(r.date).toLocaleDateString() : 'No date'}
        </div>
        <button onClick={startEdit} style={editBtnStyle}>Edit</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.9rem' }}>
        {r.rating1 != null && <span>Taste <strong>{r.rating1}</strong></span>}
        {r.rating2 != null && <span>Value <strong>{r.rating2}</strong></span>}
        {r.rating3 != null && <span>Consistency <strong>{r.rating3}</strong></span>}
        <span style={{ color: '#2563eb' }}>
          Overall <strong>{r.overallRating != null ? r.overallRating : 'Unrated'}</strong>
        </span>
      </div>
      {r.notes && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#374151' }}>{r.notes}</p>
      )}
    </div>
  )
}

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

  const onReviewUpdated = () => queryClient.invalidateQueries({ queryKey: ['entries', entryId] })

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
              <ReviewCard key={r.id} review={r} onUpdated={onReviewUpdated} />
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

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '0.875rem 1rem',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 500,
  fontSize: '0.85rem',
  marginBottom: '0.25rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  boxSizing: 'border-box',
}
const saveBtnStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.45rem 0.875rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.875rem',
}
const cancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  padding: '0.45rem 0.875rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.875rem',
}
const editBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  padding: '0.2rem 0.6rem',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.75rem',
}
