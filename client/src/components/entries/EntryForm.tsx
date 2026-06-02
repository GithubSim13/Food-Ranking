import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEntry, searchEntries } from '../../api/entries'
import { getCategories } from '../../api/categories'
import FlagPicker from '../common/FlagPicker'
import { useToast } from '../../context/ToastContext'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface CategoryComboProps {
  value: string
  onChange: (val: string) => void
}

function CategoryCombo({ value, onChange }: CategoryComboProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const filtered = categories
    .map(c => c.name)
    .filter(name => name.toLowerCase().includes(value.toLowerCase()))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        required
        style={inputStyle}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 50,
          margin: '2px 0 0',
          padding: 0,
          listStyle: 'none',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          maxHeight: 200,
          overflowY: 'auto',
        }}>
          {filtered.map(name => (
            <li
              key={name}
              onMouseDown={e => { e.preventDefault(); onChange(name); setOpen(false) }}
              style={{
                padding: '0.45rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                background: name === value ? 'var(--paper-2)' : undefined,
                color: name === value ? 'var(--accent)' : 'var(--ink)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = name === value ? 'var(--paper-2)' : '')}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function EntryForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [foodName, setFoodName] = useState('')
  const [category, setCategory] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [starred, setStarred] = useState(false)
  const [flag, setFlag] = useState<string | null>(null)

  const debouncedName = useDebounce(foodName, 300)

  const { data: dupes = [] } = useQuery({
    queryKey: ['entries', 'search', debouncedName],
    queryFn: () => searchEntries(debouncedName),
    enabled: debouncedName.length > 2,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: createEntry,
    onSuccess: entry => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      navigate(`/entries/${entry.id}`)
    },
    onError: () => {
      showToast('Failed to save entry', 'error')
    },
  })

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>New Entry</h2>

      <form
        onSubmit={e => {
          e.preventDefault()
          mutate({ foodName, category, restaurantName, starred, flag })
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <div>
          <label style={labelStyle}>Food Name</label>
          <input
            value={foodName}
            onChange={e => setFoodName(e.target.value)}
            required
            style={inputStyle}
          />
          {dupes.length > 0 && (
            <div style={{
              marginTop: '0.4rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.35)',
              borderRadius: 6,
              fontSize: '0.85rem',
              color: 'var(--ink)',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.3rem', color: '#fbbf24' }}>
                Possible duplicate{dupes.length > 1 ? 's' : ''}:
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {dupes.map(d => (
                  <li key={d.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600 }}>{d.foodName}</span>
                    <span style={{ color: 'var(--ink-mute)' }}>·</span>
                    <span>{d.restaurant.name}</span>
                    <span style={{ color: 'var(--ink-mute)' }}>·</span>
                    <span style={{ color: 'var(--ink-mute)' }}>{d.category}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <CategoryCombo value={category} onChange={setCategory} />
        </div>

        <div>
          <label style={labelStyle}>Restaurant Name</label>
          <input value={restaurantName} onChange={e => setRestaurantName(e.target.value)} required style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Country <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional)</span></label>
          <FlagPicker value={flag} onChange={setFlag} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
          <input type="checkbox" checked={starred} onChange={e => setStarred(e.target.checked)} />
          ⭐ Worth trying once in a lifetime
        </label>

        <button type="submit" disabled={isPending} style={{ ...btnStyle, opacity: isPending ? 0.6 : 1 }}>
          {isPending ? 'Saving…' : 'Save Entry'}
        </button>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 500,
  fontSize: '0.9rem',
  marginBottom: '0.3rem',
  color: 'var(--ink)',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
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
  padding: '0.6rem 1rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  alignSelf: 'flex-start',
}
