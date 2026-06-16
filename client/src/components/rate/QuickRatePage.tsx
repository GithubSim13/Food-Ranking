import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'
import { updateReview } from '../../api/reviews'
import { sortReviewsByDateDesc } from '../../utils'
import RatingInput from '../common/RatingInput'
import FlagImage from '../common/FlagImage'
import CategoryComparisonPanel from '../common/CategoryComparisonPanel'
import { useToast } from '../../context/ToastContext'
import { smallPrimaryBtnStyle, smallSecondaryBtnStyle } from '../common/pageStyles'

export default function QuickRatePage() {
  const { data: entries = [], isLoading } = useQuery({ queryKey: ['entries'], queryFn: getEntries })
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [rating1, setRating1] = useState<number | null>(null)
  const [rating2, setRating2] = useState<number | null>(null)
  const [rating3, setRating3] = useState<number | null>(null)
  const [showError, setShowError] = useState(false)
  const initialTotalRef = useRef<number | null>(null)

  const queue = useMemo(() => {
    return entries
      .filter(e => {
        if (e.reviews.length === 0) return false
        const latest = sortReviewsByDateDesc(e.reviews)[0]
        return latest.rating1 === null && latest.rating2 === null && latest.rating3 === null
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [entries])

  if (!isLoading && initialTotalRef.current === null) {
    initialTotalRef.current = queue.length
  }
  const initialTotal = initialTotalRef.current ?? 0

  const remaining = useMemo(() => queue.filter(e => !skipped.has(e.id)), [queue, skipped])
  const current = remaining[0] ?? null
  const progressFraction = initialTotal > 0 ? Math.max(0, 1 - remaining.length / initialTotal) : 1
  const latestReview = current ? sortReviewsByDateDesc(current.reviews)[0] : null

  const { mutate: saveRating, isPending } = useMutation({
    mutationFn: (payload: { reviewId: number; rating1: number; rating2: number; rating3: number }) =>
      updateReview(payload.reviewId, { rating1: payload.rating1, rating2: payload.rating2, rating3: payload.rating3 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      showToast('Rating saved.', 'success')
      advance()
    },
    onError: () => {
      showToast('Failed to save rating.', 'error')
    },
  })

  function resetSliders() {
    setRating1(null)
    setRating2(null)
    setRating3(null)
    setShowError(false)
  }

  function advance() {
    if (current) setSkipped(prev => new Set([...prev, current.id]))
    resetSliders()
  }

  function handleSkip() {
    advance()
  }

  function handleSave() {
    if (rating1 === null || rating2 === null || rating3 === null) {
      setShowError(true)
      return
    }
    if (!current || !latestReview) return
    saveRating({ reviewId: latestReview.id, rating1, rating2, rating3 })
  }

  if (isLoading) {
    return (
      <div style={centerStyle}>
        <p style={{ color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>Loading…</p>
      </div>
    )
  }

  if (!current) {
    return (
      <div style={centerStyle}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '1.4rem',
          color: 'var(--accent)',
          marginBottom: '0.5rem',
        }}>
          All caught up.
        </p>
        <p style={{ color: 'var(--ink-mute)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Nothing left to rate. You're on top of things.
        </p>
        <Link to="/entries" style={{ color: 'var(--accent)', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← Back to Entries
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', minHeight: '60vh', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div style={cardStyle}>
          {/* Progress bar */}
          <div style={{ height: 3, background: 'var(--line)', borderRadius: '2px 2px 0 0', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progressFraction * 100}%`,
              background: 'var(--accent)',
              transition: 'width 300ms ease',
              borderRadius: 2,
            }} />
          </div>

          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Progress label */}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', margin: 0 }}>
              {remaining.length} remaining
            </p>

            {/* Entry info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                <FlagImage code={current.flag} />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '1.4rem',
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}>
                  {current.foodName}
                </span>
              </div>
              <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: 0 }}>
                {current.restaurant.name} · {current.category}
              </p>
              {latestReview?.notes && (
                <ul style={{
                  color: 'var(--ink-mute)',
                  margin: '0.75rem 0 0',
                  paddingLeft: '1.25rem',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                }}>
                  {latestReview.notes.split('\n').filter(Boolean).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Rating inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <RatingInput label="Taste" value={rating1} onChange={setRating1} />
              <RatingInput label="Value" value={rating2} onChange={setRating2} />
              <RatingInput label="Consistency" value={rating3} onChange={setRating3} />
            </div>

            {/* Validation error */}
            {showError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>
                Rate all three fields to save.
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={handleSkip} style={smallSecondaryBtnStyle} disabled={isPending}>
                Skip
              </button>
              <button
                onClick={handleSave}
                style={{ ...smallPrimaryBtnStyle, opacity: isPending ? 0.6 : 1 }}
                disabled={isPending}
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <CategoryComparisonPanel
          category={current.category}
          currentEntryId={current.id}
        />
      </div>
    </div>
  )
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
  textAlign: 'center',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  width: '100%',
  maxWidth: 520,
  overflow: 'hidden',
  textAlign: 'left',
}
