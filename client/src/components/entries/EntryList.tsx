import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getEntries } from '../../api/entries'
import EntryCard from './EntryCard'
import { SearchAndScopeBar, pillStyle, matchesScope } from '../common/SearchAndScopeBar'
import type { Scope } from '../common/SearchAndScopeBar'
import { latestRating, sortReviewsByDateDesc } from '../../utils'
import { kickerStyle, pageTitleStyle } from '../common/pageStyles'

type Sort = 'recent' | 'rated' | 'az'

export default function EntryList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [sort, setSort] = useState<Sort>('recent')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  const q = search.toLowerCase()
  const wordRe = q.length > 0
    ? new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    : null

  const scoped = entries.filter(e => {
    const matchesSearch = q.length === 0 || (
      e.foodName.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.restaurant.name.toLowerCase().includes(q) ||
      (wordRe != null && e.reviews.some(r => r.notes != null && wordRe.test(r.notes)))
    )
    if (!matchesSearch) return false
    if (scope === 'uncertain') return sortReviewsByDateDesc(e.reviews)[0]?.uncertainRating === true
    return matchesScope(e, scope)
  })

  const latestDateMap = new Map(scoped.map(e => {
    const dated = sortReviewsByDateDesc(e.reviews).find(r => r.date)
    return [e.id, dated ? new Date(dated.date!).getTime() : -Infinity]
  }))

  const sorted = q.length === 0
    ? [...scoped].sort((a, b) => {
        if (sort === 'az') return a.foodName.localeCompare(b.foodName)
        if (sort === 'rated') {
          const ra = latestRating(a.reviews) ?? -1
          const rb = latestRating(b.reviews) ?? -1
          return rb - ra
        }
        // sort by most recent non-null review.date; fall back to createdAt
        const da = latestDateMap.get(a.id) ?? -Infinity
        const db = latestDateMap.get(b.id) ?? -Infinity
        if (da !== -Infinity && db !== -Infinity) return db - da
        if (da !== -Infinity) return -1
        if (db !== -Infinity) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    : (() => {
        const isP1 = (e: typeof scoped[0]) =>
          wordRe!.test(e.foodName) || wordRe!.test(e.category) || wordRe!.test(e.restaurant.name) ||
          e.reviews.some(r => r.notes != null && wordRe!.test(r.notes))
        return [...scoped.filter(isP1), ...scoped.filter(e => !isP1(e))]
      })()

  const sortPills: { key: Sort; label: string }[] = [
    { key: 'recent', label: 'Most recent' },
    { key: 'rated', label: 'Top rated' },
    { key: 'az', label: 'A–Z' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <p style={kickerStyle}>The log</p>
          <h1 style={pageTitleStyle}>Entries</h1>
        </div>
        <button onClick={() => navigate('/entries/new')} style={primaryBtnStyle}>
          Add Entry
        </button>
      </div>

      <SearchAndScopeBar
        search={search}
        onSearchChange={setSearch}
        scope={scope}
        onScopeChange={setScope}
        searchPlaceholder="Search by name, category, restaurant, or notes…"
        extraScopePills={[
          { key: 'tryAgain', label: 'Try Again' },
          { key: 'neverAgain', label: 'Never Again' },
          { key: 'uncertain', label: 'Uncertain' },
        ]}
        rightSlot={
          <div style={{ display: 'flex', gap: '0.375rem', opacity: q.length > 0 ? 0.4 : 1, pointerEvents: q.length > 0 ? 'none' : 'auto' }}>
            {sortPills.map(p => (
              <button key={p.key} className="pill" onClick={() => setSort(p.key)} style={pillStyle(sort === p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      <style>{`
        .entry-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .entry-grid > * {
          min-width: 0;
          box-sizing: border-box;
        }
        @media (max-width: 1100px) {
          .entry-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 580px) {
          .entry-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      {isLoading ? (
        <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>
      ) : (
        <div className="entry-grid">
          {sorted.map(entry => <EntryCard key={entry.id} entry={entry} />)}
          {sorted.length === 0 && (
            <p style={{ color: 'var(--ink-mute)', gridColumn: '1 / -1' }}>No entries found.</p>
          )}
        </div>
      )}
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--accent-ink)',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.875rem',
  transition: 'all 150ms ease',
}
