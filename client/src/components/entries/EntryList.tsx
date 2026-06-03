import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getEntries } from '../../api/entries'
import EntryCard from './EntryCard'
import { SearchAndScopeBar, pillStyle, matchesScope } from '../common/SearchAndScopeBar'
import type { Scope } from '../common/SearchAndScopeBar'

type Sort = 'recent' | 'rated' | 'az'

function avgRating(reviews: { overallRating: number | null }[]): number | null {
  const vals = reviews.map(r => r.overallRating).filter((r): r is number => r !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export default function EntryList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [sort, setSort] = useState<Sort>('recent')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  const scoped = entries.filter(e => {
    const q = search.toLowerCase()
    const matchesSearch =
      e.foodName.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.restaurant.name.toLowerCase().includes(q)
    if (!matchesSearch) return false
    return matchesScope(e, scope)
  })

  const sorted = [...scoped].sort((a, b) => {
    if (sort === 'az') return a.foodName.localeCompare(b.foodName)
    if (sort === 'rated') {
      const ra = avgRating(a.reviews) ?? -1
      const rb = avgRating(b.reviews) ?? -1
      return rb - ra
    }
    return b.id - a.id
  })

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
        searchPlaceholder="Search by name, category, or restaurant…"
        rightSlot={
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {sortPills.map(p => (
              <button key={p.key} onClick={() => setSort(p.key)} style={pillStyle(sort === p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sorted.map(entry => <EntryCard key={entry.id} entry={entry} />)}
          {!isLoading && sorted.length === 0 && (
            <p style={{ color: 'var(--ink-mute)' }}>No entries found.</p>
          )}
        </div>
      )}
    </div>
  )
}

const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--ink-mute)',
  marginBottom: '0.25rem',
}

const pageTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: '2rem',
  letterSpacing: '-0.03em',
  color: 'var(--ink)',
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
}
