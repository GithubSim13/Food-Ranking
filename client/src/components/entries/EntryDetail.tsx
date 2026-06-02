import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEntry, patchEntry, deleteEntry } from '../../api/entries'
import { patchRestaurant } from '../../api/restaurants'
import FlagImage from '../common/FlagImage'
import FlagPicker from '../common/FlagPicker'
import { updateReview, deleteReview } from '../../api/reviews'
import ReviewForm from '../reviews/ReviewForm'
import type { EntryDetail as EntryDetailType, Review } from '../../types'
import { useToast } from '../../context/ToastContext'

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
  const { showToast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    date: '',
    rating1: '',
    rating2: '',
    rating3: '',
    notes: '',
    retroactive: false,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateReview(r.id, {
        date: form.date || undefined,
        rating1: form.rating1 ? Number(form.rating1) : null,
        rating2: form.rating2 ? Number(form.rating2) : null,
        rating3: form.rating3 ? Number(form.rating3) : null,
        notes: form.notes || null,
        retroactive: form.retroactive,
      }),
    onSuccess: () => {
      setIsEditing(false)
      onUpdated()
      showToast('Review saved')
    },
    onError: () => {
      showToast('Failed to save review', 'error')
    },
  })

  const { mutate: doDeleteReview, isPending: isDeletingReview } = useMutation({
    mutationFn: () => deleteReview(r.id),
    onSuccess: () => {
      onUpdated()
      showToast('Review deleted')
    },
    onError: () => {
      showToast('Failed to delete review', 'error')
      setConfirmDelete(false)
    },
  })

  const startEdit = () => {
    setForm({
      date: r.date ? r.date.split('T')[0] : '',
      rating1: r.rating1?.toString() ?? '',
      rating2: r.rating2?.toString() ?? '',
      rating3: r.rating3?.toString() ?? '',
      notes: r.notes ?? '',
      retroactive: r.retroactive,
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--ink-mute, #6b7280)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.retroactive}
              onChange={e => setForm(f => ({ ...f, retroactive: e.target.checked }))}
            />
            Ratings added after the fact
          </label>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            {r.date ? new Date(r.date).toLocaleDateString() : 'No date'}
          </span>
          {r.retroactive && (
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-mute, #9ca3af)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              &#x1F559; ratings added later
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button onClick={startEdit} style={editBtnStyle}>Edit</button>
          <button onClick={() => setConfirmDelete(true)} style={editBtnStyle}>Delete</button>
        </div>
      </div>
      {confirmDelete && (
        <div style={{ marginBottom: '0.625rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
          <span style={{ flex: 1, color: '#991b1b' }}>Delete this review?</span>
          <button
            onClick={() => doDeleteReview()}
            disabled={isDeletingReview}
            style={{ ...deleteBtnStyle, opacity: isDeletingReview ? 0.6 : 1 }}
          >
            {isDeletingReview ? 'Deleting…' : 'Confirm'}
          </button>
          <button onClick={() => setConfirmDelete(false)} disabled={isDeletingReview} style={editBtnStyle}>
            Cancel
          </button>
        </div>
      )}
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
  flag: string | null
  restaurantName: string
}

export default function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const entryId = Number(id)
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(false)
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
      const newStarred = !(entry?.starred ?? false)
      await queryClient.cancelQueries({ queryKey: ['entries', entryId] })
      const prev = queryClient.getQueryData<EntryDetailType>(['entries', entryId])
      queryClient.setQueryData(['entries', entryId], (old: EntryDetailType | undefined) =>
        old ? { ...old, starred: !old.starred } : old
      )
      return { prev, newStarred }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['entries', entryId], ctx.prev)
      showToast('Failed to update star', 'error')
    },
    onSuccess: (_data, _vars, ctx) => {
      showToast(ctx?.newStarred ? 'Starred ★' : 'Unstarred')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', entryId] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })

  const { mutate: saveDetails, isPending: isSavingDetails } = useMutation({
    mutationFn: async (form: EntryEditForm) => {
      const entryPatch: { foodName?: string; category?: string; flag?: string | null } = {}
      if (form.foodName !== entry!.foodName) entryPatch.foodName = form.foodName
      if (form.category !== entry!.category) entryPatch.category = form.category
      if (form.flag !== entry!.flag) entryPatch.flag = form.flag

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
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      showToast('Entry updated')
    },
    onError: () => {
      showToast('Failed to update entry', 'error')
    },
  })

  const { mutate: doDeleteEntry, isPending: isDeletingEntry } = useMutation({
    mutationFn: () => deleteEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      showToast('Entry deleted')
      navigate('/entries')
    },
    onError: () => {
      showToast('Failed to delete entry', 'error')
      setConfirmDeleteEntry(false)
    },
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>
  if (!entry) return <p style={{ color: '#6b7280' }}>Entry not found.</p>

  const onReviewUpdated = () => queryClient.invalidateQueries({ queryKey: ['entries', entryId] })

  const startEditDetails = () => {
    setEditForm({
      foodName: entry.foodName,
      category: entry.category,
      flag: entry.flag,
      restaurantName: entry.restaurant.name,
    })
    setIsEditingDetails(true)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: '2rem' }}>
        {isEditingDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Food Name</label>
              <input
                value={editForm.foodName}
                onChange={e => setEditForm(f => ({ ...f, foodName: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <FlagPicker
                value={editForm.flag}
                onChange={code => setEditForm(f => ({ ...f, flag: code }))}
              />
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
                  background: entry.starred ? '#FEF3C7' : '#f9fafb',
                  border: entry.starred ? '2px solid #F59E0B' : '2px solid #d1d5db',
                  cursor: isTogglingStar ? 'default' : 'pointer',
                  padding: '0.4rem 0.875rem',
                  borderRadius: 8,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: entry.starred ? '#B45309' : '#6b7280',
                  opacity: isTogglingStar ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.15s',
                  boxShadow: entry.starred ? '0 0 0 3px #FDE68A' : 'none',
                }}
              >
                {entry.starred ? '★ Starred' : '☆ Star'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                {entry.category} · {entry.restaurant.name}
              </p>
              <button onClick={startEditDetails} style={editBtnStyle}>Edit</button>
              <button onClick={() => setConfirmDeleteEntry(true)} style={editBtnStyle}>Delete</button>
            </div>
            {confirmDeleteEntry && (
              <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                <span style={{ flex: 1, color: '#991b1b' }}>Are you sure? This will delete all reviews too.</span>
                <button
                  onClick={() => doDeleteEntry()}
                  disabled={isDeletingEntry}
                  style={{ ...deleteBtnStyle, opacity: isDeletingEntry ? 0.6 : 1 }}
                >
                  {isDeletingEntry ? 'Deleting…' : 'Confirm Delete'}
                </button>
                <button onClick={() => setConfirmDeleteEntry(false)} disabled={isDeletingEntry} style={editBtnStyle}>
                  Cancel
                </button>
              </div>
            )}
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
const deleteBtnStyle: React.CSSProperties = {
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  padding: '0.3rem 0.7rem',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
  flexShrink: 0,
}
