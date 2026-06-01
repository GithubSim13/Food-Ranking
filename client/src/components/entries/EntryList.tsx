import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getEntries } from '../../api/entries'
import EntryCard from './EntryCard'

export default function EntryList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  const filtered = entries.filter(e => {
    const q = search.toLowerCase()
    return (
      e.foodName.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.restaurant.name.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Entries</h2>
        <button onClick={() => navigate('/entries/new')} style={btnStyle}>
          Add Entry
        </button>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, category, or restaurant…"
        style={inputStyle}
      />

      {isLoading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(entry => <EntryCard key={entry.id} entry={entry} />)}
          {!isLoading && filtered.length === 0 && (
            <p style={{ color: '#6b7280' }}>No entries found.</p>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  marginBottom: '1rem',
}

const btnStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
}
