import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEntry, searchEntries } from '../../api/entries'
import FlagPicker from '../common/FlagPicker'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function EntryForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
              background: '#fef9c3',
              border: '1px solid #fbbf24',
              borderRadius: 6,
              fontSize: '0.85rem',
              color: '#92400e',
            }}>
              Possible duplicate{dupes.length > 1 ? 's' : ''}:{' '}
              {dupes.map(d => `${d.foodName} (${d.restaurant.name})`).join(', ')}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <input value={category} onChange={e => setCategory(e.target.value)} required style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Restaurant Name</label>
          <input value={restaurantName} onChange={e => setRestaurantName(e.target.value)} required style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Country <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
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
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
}
const btnStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.6rem 1rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  alignSelf: 'flex-start',
}
