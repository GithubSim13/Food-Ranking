import { useNavigate, useLocation } from 'react-router-dom'
import type { Entry } from '../../types'
import FlagImage from '../common/FlagImage'
import { latestRating, sortReviewsByDateDesc, scoreColor } from '../../utils'

export default function EntryCard({ entry }: { entry: Entry }) {
  const navigate = useNavigate()
  const location = useLocation()
  const avg = latestRating(entry.reviews)

  const sorted = sortReviewsByDateDesc(entry.reviews)
  const noteReview = sorted.find(r => r.notes && r.notes.trim() !== '')
  const quote = noteReview ? noteReview.notes!.split('\n')[0].trim() : null

  return (
    <div
      onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
      style={{
        background: entry.starred ? 'var(--gold-wash)' : 'var(--surface)',
        border: entry.starred ? '1px solid var(--gold)' : '1px solid var(--line)',
        borderRadius: 14,
        padding: '1rem 1.125rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
      }}
    >
      {/* Flag + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '1rem', color: entry.starred ? 'var(--gold)' : 'var(--ink)', minWidth: 0 }}>
        <FlagImage code={entry.flag} />
        {entry.starred && <span style={{ fontSize: '0.75rem', color: 'var(--gold)', flexShrink: 0 }}>★</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.foodName}</span>
      </div>

      {/* Quote — first line of most recent review with notes */}
      {quote && (
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)', fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          "{quote}"
        </div>
      )}

      {/* Category · Restaurant + Rating */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '0.25rem', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.category} · {entry.restaurant.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {entry.tryAgain && <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: '#3b82f6' }} />}
          {entry.neverAgain && <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: '#ef4444' }} />}
          {entry.reviews.some(r => r.uncertainRating === true) && <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: '#eab308' }} />}
          {avg !== null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: scoreColor(avg) }}>
              {avg.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
