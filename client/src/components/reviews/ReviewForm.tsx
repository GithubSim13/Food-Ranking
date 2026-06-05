import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createReview } from '../../api/reviews'
import { useToast } from '../../context/ToastContext'
import RatingInput from '../common/RatingInput'

interface Props {
  entryId: number
  onSuccess: () => void
}

const RATING_FIELDS = [
  { label: 'Taste', key: 'rating1' },
  { label: 'Value', key: 'rating2' },
  { label: 'Consistency', key: 'rating3' },
] as const

export default function ReviewForm({ entryId, onSuccess }: Props) {
  const { showToast } = useToast()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [ratings, setRatings] = useState<{ rating1: number | null; rating2: number | null; rating3: number | null }>(
    { rating1: null, rating2: null, rating3: null }
  )
  const [notes, setNotes] = useState('')
  const [uncertainRating, setUncertainRating] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: createReview,
    onSuccess: () => {
      setDate(today)
      setRatings({ rating1: null, rating2: null, rating3: null })
      setNotes('')
      setUncertainRating(false)
      onSuccess()
    },
    onError: () => {
      showToast('Failed to save review', 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutate({
      entryId,
      date: date || undefined,
      notes: notes || undefined,
      rating1: ratings.rating1 ?? undefined,
      rating2: ratings.rating2 ?? undefined,
      rating3: ratings.rating3 ?? undefined,
      uncertainRating,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div>
        <label style={labelStyle}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {RATING_FIELDS.map(({ label, key }) => (
          <RatingInput
            key={key}
            label={label}
            value={ratings[key]}
            onChange={n => setRatings(r => ({ ...r, [key]: n }))}
          />
        ))}
      </div>

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--ink-mute)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={uncertainRating}
          onChange={e => setUncertainRating(e.target.checked)}
        />
        Ratings added after the fact
      </label>

      <button type="submit" disabled={isPending} style={{ ...btnStyle, opacity: isPending ? 0.6 : 1 }}>
        {isPending ? 'Saving…' : 'Add Review'}
      </button>
    </form>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 500,
  fontSize: '0.85rem',
  marginBottom: '0.25rem',
  color: 'var(--ink)',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  background: 'var(--paper)',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  boxSizing: 'border-box',
}
const btnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  padding: '0.55rem 1rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  alignSelf: 'flex-start',
}
