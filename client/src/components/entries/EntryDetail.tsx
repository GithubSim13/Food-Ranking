import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEntry, patchEntry } from '../../api/entries'
import { patchRestaurant } from '../../api/restaurants'
import FlagImage from '../common/FlagImage'
import { updateReview } from '../../api/reviews'
import ReviewForm from '../reviews/ReviewForm'
import type { EntryDetail as EntryDetailType, Review } from '../../types'

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
          Overall <strong>{r.overallRating != null ? r.overallRating.toFixed(2) : 'Unrated'}</strong>
        </span>
      </div>
      {r.notes && (() => {
        const lines = r.notes.split('\n').filter(l => l.trim() !== '')
        return lines.length > 0 ? (
          <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.25rem', fontSize: '0.9rem', color: '#374151' }}>
            {lines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        ) : null
      })()}
    </div>
  )
}

interface EntryEditForm {
  foodName: string
  category: string
  flag: string
  restaurantName: string
}

export default function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const entryId = Number(id)
  const queryClient = useQueryClient()

  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [editForm, setEditForm] = useState<EntryEditForm>({
    foodName: '',
    category: '',
    flag: '',
    restaurantName: '',
  })

  const { data: entry, isLoading } = useQuery({
    queryKey: ['entries', entryId],
    queryFn: () => getEntry(entryId),
  })

  const { mutate: toggleStar, isPending: isTogglingStar } = useMutation({
    mutationFn: () => patchEntry(entryId, { starred: !(entry?.starred ?? false) }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['entries', entryId] })
      const prev = queryClient.getQueryData<EntryDetailType>(['entries', entryId])
      queryClient.setQueryData(['entries', entryId], (old: EntryDetailType | undefined) =>
        old ? { ...old, starred: !old.starred } : old
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['entries', entryId], ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', entryId] })
    },
  })

  const { mutate: saveDetails, isPending: isSavingDetails } = useMutation({
    mutationFn: async (form: EntryEditForm) => {
      const entryPatch: { foodName?: string; category?: string; flag?: string | null } = {}
      if (form.foodName !== entry!.foodName) entryPatch.foodName = form.foodName
      if (form.category !== entry!.category) entryPatch.category = form.category
      if ((form.flag || null) !== entry!.flag) entryPatch.flag = form.flag || null

      const promises: Promise<unknown>[] = []
      if (Object.keys(entryPatch).length > 0) {
        promises.push(patchEntry(entryId, entryPatch))
      }
      if (form.restaurantName !== entry!.restaurant.name) {
        promises.push(patchRestaurant(entry!.restaurantId, { name: form.restaurantName }))
      }
      await Promise.all(promises)
    },
    onSuccess: () => {
      setIsEditingDetails(false)
      queryClient.invalidateQueries({ queryKey: ['entries', entryId] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>
  if (!entry) return <p style={{ color: '#6b7280' }}>Entry not found.</p>

  const onReviewUpdated = () => queryClient.invalidateQueries({ queryKey: ['entries', entryId] })

  const startEditDetails = () => {
    setEditForm({
      foodName: entry.foodName,
      category: entry.category,
      flag: entry.flag ?? '',
      restaurantName: entry.restaurant.name,
    })
    setIsEditingDetails(true)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: '2rem' }}>
        {isEditingDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Food Name</label>
                <input
                  value={editForm.foodName}
                  onChange={e => setEditForm(f => ({ ...f, foodName: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Flag</label>
                <input
                  value={editForm.flag}
                  onChange={e => setEditForm(f => ({ ...f, flag: e.target.value }))}
                  placeholder="🇯🇵"
                  style={{ ...inputStyle, width: 80 }}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <input
                value={editForm.category}
                onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Restaurant</label>
              <input
                value={editForm.restaurantName}
                onChange={e => setEditForm(f => ({ ...f, restaurantName: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => saveDetails(editForm)}
                disabled={isSavingDetails}
                style={{ ...saveBtnStyle, opacity: isSavingDetails ? 0.6 : 1 }}
              >
                {isSavingDetails ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setIsEditingDetails(false)}
                disabled={isSavingDetails}
                style={{ ...cancelBtnStyle, opacity: isSavingDetails ? 0.6 : 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FlagImage code={entry.flag} style={{ width: '1.1em' }} />
                {entry.foodName}
              </h2>
              <button
                onClick={() => toggleStar()}
                disabled={isTogglingStar}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: isTogglingStar ? 'default' : 'pointer',
                  padding: '0.2rem 0.4rem',
                  borderRadius: 4,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: entry.starred ? '#F59E0B' : '#9ca3af',
                  opacity: isTogglingStar ? 0.5 : 1,
                }}
              >
                {entry.starred ? '★ Starred' : '☆ Add Star'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                {entry.category} · {entry.restaurant.name}
              </p>
              <button onClick={startEditDetails} style={editBtnStyle}>Edit</button>
            </div>
          </>
        )}
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
