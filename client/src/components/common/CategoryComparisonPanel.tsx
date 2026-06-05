import { useState } from 'react'
import ReactDOM from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'
import { sortReviewsByDateDesc, latestRatedReview } from '../../utils'

interface Props {
  category: string
  currentEntryId?: number
}

interface ComparisonRow {
  id: number
  foodName: string
  flag: string | null
  restaurantName: string
  overall: number
  taste: number | null
  value: number | null
  consistency: number | null
  reviewCount: number
  latestDate: string | null
  latestNotes: string[]
}

interface HoveredRow {
  id: number
  rect: DOMRect
}

export default function CategoryComparisonPanel({ category, currentEntryId }: Props) {
  const [hovered, setHovered] = useState<HoveredRow | null>(null)

  const { data: entries = [] } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  const comparisons: ComparisonRow[] = entries
    .filter(e => e.category === category && e.id !== currentEntryId)
    .map(e => {
      const latest = latestRatedReview(e.reviews)
      if (latest === null) return null
      const sorted = sortReviewsByDateDesc(e.reviews)
      const latestReview = sorted[0] ?? null
      const latestDate = sorted.find(r => r.date)?.date ?? null
      const latestNotes = latestReview?.notes
        ? latestReview.notes.split('\n').map(l => l.trim()).filter(Boolean)
        : []
      return {
        id: e.id,
        foodName: e.foodName,
        flag: e.flag,
        restaurantName: e.restaurant.name,
        overall: latest.overallRating!,
        taste: latestReview?.rating1 ?? null,
        value: latestReview?.rating2 ?? null,
        consistency: latestReview?.rating3 ?? null,
        reviewCount: e.reviews.length,
        latestDate,
        latestNotes,
      }
    })
    .filter((e): e is ComparisonRow => e !== null)
    .sort((a, b) => b.overall - a.overall)

  const fmt1 = (v: number | null) => (v != null ? v.toFixed(1) : '—')

  const hoveredRow = hovered ? comparisons.find(c => c.id === hovered.id) ?? null : null

  const popup =
    hovered && hoveredRow
      ? ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              left: Math.max(8, hovered.rect.left - 228),
              top: Math.max(8, Math.min(hovered.rect.top, window.innerHeight - 160)),
              width: 220,
              background: 'var(--paper-2)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '0.75rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-mute)', marginBottom: hoveredRow.latestNotes.length ? '0.5rem' : 0 }}>
              {hoveredRow.restaurantName}
            </div>
            {hoveredRow.latestNotes.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: '1.1rem', listStyle: 'disc' }}>
                {hoveredRow.latestNotes.map((line, i) => (
                  <li key={i} style={{ fontSize: '0.78rem', color: 'var(--ink-mute)', lineHeight: 1.5 }}>
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body
        )
      : null

  return (
    <div
      style={{
        width: 264,
        flexShrink: 0,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '1rem',
        alignSelf: 'flex-start',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
      onMouseLeave={() => setHovered(null)}
    >
      {popup}
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--ink-mute)',
        marginBottom: '0.75rem',
        opacity: 0.8,
      }}>
        {category} · others
      </p>

      {comparisons.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--ink-mute)' }}>
          No other rated entries in this category.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {comparisons.map((c, i) => (
            <div
              key={c.id}
              onMouseEnter={e => setHovered({ id: c.id, rect: e.currentTarget.getBoundingClientRect() })}
              style={{
                padding: '0.5rem 0.625rem',
                background: 'var(--paper)',
                borderRadius: 8,
                border: '1px solid var(--line)',
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', marginBottom: '0.3rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-mute)', width: 14, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.foodName}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent)', flexShrink: 0 }}>
                  {c.overall.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.625rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', paddingLeft: 18 }}>
                <span>T {fmt1(c.taste)}</span>
                <span>V {fmt1(c.value)}</span>
                <span>C {fmt1(c.consistency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
