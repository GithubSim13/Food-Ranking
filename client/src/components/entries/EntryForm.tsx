import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createEntry, searchEntries } from '../../api/entries'
import { createReview } from '../../api/reviews'
import { getCategories } from '../../api/categories'
import { getRestaurants } from '../../api/restaurants'
import FlagPicker from '../common/FlagPicker'
import RatingInput from '../common/RatingInput'
import CategoryComparisonPanel from '../common/CategoryComparisonPanel'
import { useToast } from '../../context/ToastContext'
import { smallSecondaryBtnStyle } from '../common/pageStyles'
import { RATING_FIELDS } from '../../types'
import { autoResize, getLocalDateString } from '../../utils'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── combo boxes ──────────────────────────────────────────────────────────────

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
        style={inputStyle}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={dropdownStyle}>
          {filtered.map(name => (
            <li
              key={name}
              onMouseDown={e => { e.preventDefault(); onChange(name); setOpen(false) }}
              style={dropdownItemStyle(name === value)}
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

interface RestaurantComboProps {
  value: string
  onChange: (val: string) => void
}

function RestaurantCombo({ value, onChange }: RestaurantComboProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants'],
    queryFn: getRestaurants,
  })

  const filtered = restaurants
    .map(r => r.name)
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
        style={inputStyle}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={dropdownStyle}>
          {filtered.map(name => (
            <li
              key={name}
              onMouseDown={e => { e.preventDefault(); onChange(name); setOpen(false) }}
              style={dropdownItemStyle(name === value)}
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

// ─── main form ────────────────────────────────────────────────────────────────

export default function EntryForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [foodName, setFoodName] = useState('')
  const [category, setCategory] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [starred, setStarred] = useState(false)
  const [flag, setFlag] = useState<string | null>(null)

  const [showReview, setShowReview] = useState(false)
  const [ratings, setRatings] = useState<{ rating1: number | null; rating2: number | null; rating3: number | null }>(
    { rating1: null, rating2: null, rating3: null }
  )
  const [notes, setNotes] = useState('')
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const [isPending, setIsPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const debouncedName = useDebounce(foodName, 300)

  const { data: dupes = [] } = useQuery({
    queryKey: ['entries', 'search', debouncedName],
    queryFn: () => searchEntries(debouncedName),
    enabled: debouncedName.length > 2,
  })

  const clearReview = () => {
    setRatings({ rating1: null, rating2: null, rating3: null })
    setNotes('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!foodName.trim()) newErrors.foodName = 'Food name is required'
    if (!category.trim()) newErrors.category = 'Category is required'
    if (!restaurantName.trim()) newErrors.restaurantName = 'Restaurant name is required'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setIsPending(true)
    try {
      const entry = await createEntry({ foodName, category, restaurantName, starred, flag })

      if (showReview) {
        const reviewPayload: Parameters<typeof createReview>[0] = {
          entryId: entry.id,
          date: getLocalDateString(),
        }
        if (ratings.rating1 != null) reviewPayload.rating1 = ratings.rating1
        if (ratings.rating2 != null) reviewPayload.rating2 = ratings.rating2
        if (ratings.rating3 != null) reviewPayload.rating3 = ratings.rating3
        if (notes.trim()) reviewPayload.notes = notes.trim()

        try {
          await createReview(reviewPayload)
          queryClient.invalidateQueries({ queryKey: ['rankings'] })
        } catch {
          showToast('Entry saved, but review failed to save', 'error')
        }
      }

      queryClient.invalidateQueries({ queryKey: ['entries'] })
      navigate(`/entries/${entry.id}`)
    } catch {
      showToast('Failed to save entry', 'error')
    } finally {
      setIsPending(false)
    }
  }

  const showPanel = showReview && category.trim().length > 0

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
      <div style={{ width: 480, flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>New Entry</h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <label style={labelStyle}>Food Name</label>
            <input
              value={foodName}
              onChange={e => { setFoodName(e.target.value); setErrors(err => ({ ...err, foodName: '' })) }}
              style={inputStyle}
            />
            {errors.foodName && <p style={errorStyle}>{errors.foodName}</p>}
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
            <CategoryCombo value={category} onChange={val => { setCategory(val); setErrors(err => ({ ...err, category: '' })) }} />
            {errors.category && <p style={errorStyle}>{errors.category}</p>}
          </div>

          <div>
            <label style={labelStyle}>Restaurant Name</label>
            <RestaurantCombo value={restaurantName} onChange={val => { setRestaurantName(val); setErrors(err => ({ ...err, restaurantName: '' })) }} />
            {errors.restaurantName && <p style={errorStyle}>{errors.restaurantName}</p>}
          </div>

          <div>
            <label style={labelStyle}>Country <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional)</span></label>
            <FlagPicker value={flag} onChange={setFlag} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
            <input type="checkbox" checked={starred} onChange={e => setStarred(e.target.checked)} />
            ⭐ Worth trying once in a lifetime
          </label>

          {/* Inline review section */}
          <div>
            <button
              type="button"
              style={smallSecondaryBtnStyle}
              onClick={() => {
                if (showReview) clearReview()
                setShowReview(v => !v)
              }}
            >
              {showReview ? '− Remove Review' : '+ Add Review'}
            </button>

            {showReview && (
              <div style={{
                marginTop: '0.875rem',
                padding: '1rem',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
              }}>
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
                  <label style={labelStyle}>Notes <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(optional)</span></label>
                  <textarea
                    ref={notesRef}
                    value={notes}
                    onChange={e => { setNotes(e.target.value); autoResize(e.target) }}
                    rows={3}
                    style={{ ...inputStyle, resize: 'none', overflow: 'hidden' }}
                  />
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={isPending} style={{ ...btnStyle, opacity: isPending ? 0.6 : 1 }}>
            {isPending ? 'Saving…' : 'Save Entry'}
          </button>
        </form>
      </div>

      {showPanel && <CategoryComparisonPanel category={category.trim()} />}
    </div>
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
const dropdownStyle: React.CSSProperties = {
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
}
const dropdownItemStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.45rem 0.75rem',
  cursor: 'pointer',
  fontSize: '0.9rem',
  background: active ? 'var(--paper-2)' : undefined,
  color: active ? 'var(--accent)' : 'var(--ink)',
})
const btnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  alignSelf: 'flex-start',
  transition: 'all 150ms ease',
}
const errorStyle: React.CSSProperties = {
  margin: '0.3rem 0 0',
  fontSize: '0.82rem',
  color: 'var(--danger)',
  fontFamily: 'var(--font-body)',
}
