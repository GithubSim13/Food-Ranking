import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRestaurants, patchRestaurant, deleteRestaurant } from '../../api/restaurants'
import { getEntries } from '../../api/entries'
import { useToast } from '../../context/ToastContext'
import { latestRating, scoreColor, autoResize } from '../../utils'
import { PencilIcon, TrashIcon, ChevronIcon, iconBtnStyle } from '../common/Icons'
import { pillStyle } from '../common/SearchAndScopeBar'
import { kickerStyle, pageTitleStyle, smallPrimaryBtnStyle, smallSecondaryBtnStyle, smallDeleteBtnStyle } from '../common/pageStyles'

type SortCol = 'name' | 'foods' | 'avg'
type SortDir = 'asc' | 'desc'

const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#FBEAF0', text: '#993556' },
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: 'var(--surface)', text: 'var(--ink-mute)' },
]

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

const sortPills: { key: SortCol; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'foods', label: 'Foods' },
  { key: 'avg', label: 'Avg rating' },
]

export default function RestaurantsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data: restaurants = [], isLoading } = useQuery({ queryKey: ['restaurants'], queryFn: getRestaurants })
  const { data: allEntries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [notesValue, setNotesValue] = useState('')
  const [editError, setEditError] = useState('')
  const [deletingRestaurant, setDeletingRestaurant] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const notesRef = useRef<HTMLTextAreaElement>(null)

  // Auto-size the notes textarea whenever edit mode opens or its content changes.
  useEffect(() => {
    if (notesRef.current) autoResize(notesRef.current)
  }, [editingId, notesValue])

  const { mutate: doSave, isPending: isSaving } = useMutation({
    mutationFn: ({ id, name, notes }: { id: number; name: string; notes: string | null }) =>
      patchRestaurant(id, { name, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setEditingId(null)
      showToast('Restaurant updated')
    },
    onError: () => showToast('Failed to update restaurant', 'error'),
  })

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => deleteRestaurant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      showToast('Restaurant deleted')
      setDeletingRestaurant(null)
    },
    onError: () => {
      showToast('Failed to delete restaurant', 'error')
      setDeletingRestaurant(null)
    },
  })

  const { restAvgMap, entriesByRestaurantId, starredCountMap, topDishMap } = useMemo(() => {
    const byId = new Map<number, typeof allEntries>()
    for (const e of allEntries) {
      const list = byId.get(e.restaurantId) ?? []
      list.push(e)
      byId.set(e.restaurantId, list)
    }
    const avgMap = new Map<number, number | null>()
    const starredMap = new Map<number, number>()
    const dishMap = new Map<number, { foodName: string; rating: number } | null>()
    for (const [id, entries] of byId) {
      const ratings = entries.map(e => latestRating(e.reviews)).filter((r): r is number => r !== null)
      avgMap.set(id, ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null)
      starredMap.set(id, entries.filter(e => e.starred).length)
      let top: { foodName: string; rating: number } | null = null
      for (const e of entries) {
        const r = latestRating(e.reviews)
        if (r !== null && (top === null || r > top.rating)) top = { foodName: e.foodName, rating: r }
      }
      dishMap.set(id, top)
    }
    return { restAvgMap: avgMap, entriesByRestaurantId: byId, starredCountMap: starredMap, topDishMap: dishMap }
  }, [allEntries])

  function toggleExpanded(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const q = search.toLowerCase()
  const filtered = restaurants.filter(r => r.name.toLowerCase().includes(q))

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortCol === 'foods') {
        cmp = a.entryCount - b.entryCount
      } else {
        const aAvg = restAvgMap.get(a.id) ?? -1
        const bAvg = restAvgMap.get(b.id) ?? -1
        cmp = aAvg - bAvg
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir, restAvgMap])

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function startEdit(id: number, name: string, notes: string | null) {
    setDeletingRestaurant(null)
    setNameValue(name)
    setNotesValue(notes ?? '')
    setEditError('')
    setEditingId(id)
  }

  function saveEdit(id: number) {
    if (!nameValue.trim()) { setEditError('Name is required'); return }
    const trimmedNotes = notesValue.trim()
    doSave({ id, name: nameValue.trim(), notes: trimmedNotes === '' ? null : trimmedNotes })
  }

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>

  return (
    <div>
      <p style={kickerStyle}>Where you ate</p>
      <h2 style={{ ...pageTitleStyle, marginBottom: '1.25rem' }}>Restaurants</h2>

      {/* Full-width search */}
      <div style={{ position: 'relative', width: '100%', marginBottom: '0.875rem' }}>
        <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none', display: 'flex' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search restaurants…"
          style={{
            width: '100%',
            padding: '0.6rem 0.85rem 0.6rem 2.4rem',
            border: '1px solid var(--line)',
            borderRadius: 8,
            background: 'var(--surface)',
            color: 'var(--ink)',
            outline: 'none',
            boxSizing: 'border-box',
            fontSize: '0.9rem',
          }}
        />
      </div>

      {/* Sort pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', marginRight: '0.25rem' }}>Sort</span>
        {sortPills.map(p => (
          <button key={p.key} className="pill" onClick={() => handleSort(p.key)} style={pillStyle(sortCol === p.key)}>
            {p.label}
            {sortCol === p.key && (
              <span style={{ marginLeft: 5, fontSize: '0.65rem' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
            )}
          </button>
        ))}
      </div>

      <style>{`
        .restaurant-grid {
          column-count: 3;
          column-gap: 1rem;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .restaurant-grid > * {
          min-width: 0;
          box-sizing: border-box;
        }
        @media (max-width: 1100px) {
          .restaurant-grid { column-count: 2; }
        }
        @media (max-width: 580px) {
          .restaurant-grid { column-count: 1; }
        }
        .restaurant-entry-row:hover {
          background: var(--surface);
        }
      `}</style>

      <div className="restaurant-grid">
        {sorted.map((rest, i) => {
          const avg = restAvgMap.get(rest.id) ?? null
          const isEditing = editingId === rest.id
          const isDelConfirm = deletingRestaurant === rest.id
          const isExpanded = expandedIds.has(rest.id)
          const restEntries = entriesByRestaurantId.get(rest.id) ?? []
          const { bg, text } = AVATAR_COLORS[i % 5]
          const starredCount = starredCountMap.get(rest.id) ?? 0
          const hasStarred = starredCount > 0
          const topDish = topDishMap.get(rest.id) ?? null

          return (
            <div key={rest.id} style={cardStyle}>
              <div style={{ ...stripeStyle, background: hasStarred ? 'var(--gold)' : 'var(--accent)' }} />
              {isEditing ? (
                <>
                  <label style={fieldLabelStyle}>Name</label>
                  <input
                    value={nameValue}
                    onChange={e => { setNameValue(e.target.value); setEditError('') }}
                    autoFocus
                    style={inputStyle}
                  />
                  {editError && <p style={editErrorStyle}>{editError}</p>}

                  <label style={{ ...fieldLabelStyle, marginTop: '0.75rem' }}>Notes</label>
                  <textarea
                    ref={notesRef}
                    value={notesValue}
                    onChange={e => { setNotesValue(e.target.value); autoResize(e.currentTarget) }}
                    onPaste={e => { const el = e.currentTarget; setTimeout(() => autoResize(el), 0) }}
                    placeholder="Notes about this restaurant…"
                    rows={3}
                    style={{ ...inputStyle, resize: 'none', overflow: 'hidden', minHeight: 64, lineHeight: 1.5 }}
                  />

                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.875rem' }}>
                    <button
                      onClick={() => saveEdit(rest.id)}
                      disabled={isSaving}
                      style={{ ...smallPrimaryBtnStyle, opacity: isSaving ? 0.6 : 1 }}
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} disabled={isSaving} style={smallSecondaryBtnStyle}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9,
                      background: bg,
                      color: text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      flexShrink: 0,
                      userSelect: 'none',
                    }}>
                      {getInitials(rest.name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rest.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                        {rest.entryCount} {rest.entryCount === 1 ? 'food' : 'foods'}
                        {starredCount > 0 && (
                          <> · <span style={{ color: 'var(--gold)' }}>★</span> {starredCount} starred</>
                        )}
                      </div>
                    </div>

                    {/* Top-right actions */}
                    <div style={{ display: 'flex', gap: '0.2rem', marginLeft: 'auto', flexShrink: 0 }}>
                      {restEntries.length > 0 && (
                        <button
                          onClick={() => toggleExpanded(rest.id)}
                          title={isExpanded ? 'Hide foods' : 'Show foods'}
                          aria-expanded={isExpanded}
                          className="icon-btn"
                          style={{ ...iconBtnStyle, color: isExpanded ? 'var(--accent)' : 'var(--ink-mute)' }}
                        >
                          <ChevronIcon open={isExpanded} />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(rest.id, rest.name, rest.notes)}
                        title="Edit restaurant"
                        className="icon-btn"
                        style={iconBtnStyle}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setDeletingRestaurant(rest.id) }}
                        title="Delete restaurant"
                        className="icon-btn-danger"
                        style={{ ...iconBtnStyle, color: 'var(--danger)' }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {/* Avg rating bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem' }}>
                    {avg !== null ? (
                      <>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                          <div style={{ width: `${(avg / 10) * 100}%`, height: '100%', borderRadius: 3, background: scoreColor(avg) }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.88rem', color: scoreColor(avg), minWidth: 38, textAlign: 'right' }}>
                          {avg.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-mute)' }}>Unrated</span>
                    )}
                  </div>

                  {/* Top dish mini-pill */}
                  {topDish && (
                    <div style={topDishPillStyle}>
                      <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>★ TOP</span>
                      <span style={{ color: 'var(--ink)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {topDish.foodName}
                      </span>
                      <span style={{ marginLeft: 'auto', color: scoreColor(topDish.rating), fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {topDish.rating.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* Expandable entry list */}
                  {isExpanded && restEntries.length > 0 && (
                    <div style={{ marginTop: '0.875rem', borderTop: '1px solid var(--line)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column' }}>
                      {restEntries.map(e => {
                        const rating = latestRating(e.reviews)
                        return (
                          <div
                            key={e.id}
                            onClick={() => navigate(`/entries/${e.id}`, { state: { background: location } })}
                            className="restaurant-entry-row"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.4rem', borderRadius: 6, cursor: 'pointer' }}
                          >
                            <span style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.foodName}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
                              · {e.category}
                            </span>
                            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.82rem', color: rating !== null ? scoreColor(rating) : 'var(--ink-mute)', flexShrink: 0 }}>
                              {rating !== null ? rating.toFixed(1) : '–'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Notes */}
                  {rest.notes && (
                    <pre style={notesBlockStyle}>{rest.notes}</pre>
                  )}

                  {/* Delete confirmation */}
                  {isDelConfirm && (
                    rest.entryCount > 0 ? (
                      <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ flex: 1, color: 'var(--gold)' }}>
                          Can't delete: {rest.entryCount} {rest.entryCount === 1 ? 'entry' : 'entries'} assigned.
                        </span>
                        <button onClick={() => setDeletingRestaurant(null)} style={smallSecondaryBtnStyle}>Close</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ flex: 1, color: 'var(--danger)' }}>Delete this restaurant?</span>
                        <button
                          onClick={() => doDelete(rest.id)}
                          disabled={isDeleting}
                          style={{ ...smallDeleteBtnStyle, opacity: isDeleting ? 0.6 : 1 }}
                        >
                          {isDeleting ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button onClick={() => setDeletingRestaurant(null)} disabled={isDeleting} style={smallSecondaryBtnStyle}>
                          Cancel
                        </button>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          )
        })}
        {sorted.length === 0 && (
          <p style={{ color: 'var(--ink-mute)', fontSize: '0.9rem', gridColumn: '1 / -1' }}>
            {search ? `No restaurants match "${search}".` : 'No restaurants yet.'}
          </p>
        )}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  position: 'relative',
  background: 'var(--paper-2)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  breakInside: 'avoid',
  marginBottom: '1rem',
  overflow: 'hidden',
}

const stripeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 3,
  borderRadius: '12px 12px 0 0',
}

const topDishPillStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  marginTop: '0.75rem',
  padding: '7px 10px',
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 8,
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--ink-mute)',
  fontFamily: 'var(--font-mono)',
  marginBottom: '0.3rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  border: '1px solid var(--line)',
  borderRadius: 6,
  fontSize: '0.88rem',
  background: 'var(--paper)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-body)',
}

const notesBlockStyle: React.CSSProperties = {
  margin: '0.875rem 0 0',
  padding: '0.6rem 0.7rem',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  color: 'var(--ink-mute)',
  lineHeight: 1.5,
  maxHeight: 120,
  overflowY: 'auto',
}

const editErrorStyle: React.CSSProperties = {
  margin: '0.3rem 0 0',
  fontSize: '0.8rem',
  color: 'var(--danger)',
  fontFamily: 'var(--font-body)',
}
