import { useNavigate, useLocation } from 'react-router-dom'
import type { Entry } from '../../types'
import FlagImage from '../common/FlagImage'
import EntryFlagBadges from '../common/EntryFlagBadges'
import { latestRating, sortReviewsByDateDesc, scoreColor, scoreColorAlpha } from '../../utils'

export default function EntryCard({ entry, index = 0 }: { entry: Entry; index?: number }) {
  const navigate = useNavigate()
  const location = useLocation()
  const avg = latestRating(entry.reviews)

  const sorted = sortReviewsByDateDesc(entry.reviews)
  const noteReview = sorted.find(r => r.notes && r.notes.trim() !== '')
  const quote = noteReview ? noteReview.notes!.split('\n')[0].trim() : null

  // Subtle score-based glow — distinguishes a high-rated card from a low one at
  // a glance. Unrated cards get no glow.
  const scoreGlow = avg !== null ? `0 4px 18px -8px ${scoreColorAlpha(avg, 0.2)}` : undefined

  return (
    <div
      className={`hover-lift anim-fade-slide-up anim-delay-${Math.min(index + 1, 8)}${entry.starred ? ' card-gleam' : ''}`}
      onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: entry.starred ? 'var(--gold-wash)' : 'var(--surface)',
        border: entry.starred ? '1px solid var(--gold)' : '1px solid var(--line)',
        borderRadius: 14,
        padding: '1rem 1.125rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
        boxShadow: scoreGlow,
      }}
    >
      {/* Flag + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '1rem', color: entry.starred ? 'var(--gold)' : 'var(--ink)', minWidth: 0 }}>
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
          <EntryFlagBadges tryAgain={entry.tryAgain} neverAgain={entry.neverAgain} uncertainRating={sorted[0]?.uncertainRating === true} />
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
