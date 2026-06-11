import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRestaurants, patchRestaurant, deleteRestaurant } from '../../api/restaurants'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'
import { useToast } from '../../context/ToastContext'
import { latestRating, scoreColor } from '../../utils'
import { PencilIcon, TrashIcon, ChevronIcon, iconBtnStyle } from '../common/Icons'
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

export default function RestaurantsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data: restaurants = [], isLoading } = useQuery({ queryKey: ['restaurants'], queryFn: getRestaurants })
  const { data: allEntries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [deletingRestaurant, setDeletingRestaurant] = useState<number | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { mutate: doRename, isPending: isRenaming } = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => patchRestaurant(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setEditingId(null)
      showToast('Restaurant renamed')
    },
    onError: () => showToast('Failed to rename restaurant', 'error'),
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

  const { restAvgMap, entriesByRestaurantId } = useMemo(() => {
    const byId = new Map<number, typeof allEntries>()
    for (const e of allEntries) {
      const list = byId.get(e.restaurantId) ?? []
      list.push(e)
      byId.set(e.restaurantId, list)
    }
    const avgMap = new Map<number, number | null>()
    for (const [id, entries] of byId) {
      const ratings = entries.map(e => latestRating(e.reviews)).filter((r): r is number => r !== null)
      avgMap.set(id, ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null)
    }
    return { restAvgMap: avgMap, entriesByRestaurantId: byId }
  }, [allEntries])

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

  function SortArrow({ col }: { col: SortCol }) {
    if (sortCol !== col)
      return <span style={{ color: 'var(--ink-mute)', marginLeft: 4, fontSize: '0.65rem', opacity: 0.5 }}>↕</span>
    return (
      <span style={{ color: 'var(--accent)', marginLeft: 4, fontSize: '0.65rem' }}>
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>

  return (
    <div>
      <p style={kickerStyle}>Where you ate</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ ...pageTitleStyle, marginBottom: 0 }}>Restaurants</h2>
        <div style={{ position: 'relative', flexShrink: 0, width: 260 }}>
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search restaurants…"
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.25rem',
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
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--line)' }}>
            <th style={{ ...thStyle, width: 28 }} />
            <th style={{ ...thStyle, width: 44, textAlign: 'center' }}>#</th>
            <th style={{ ...thStyle, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
              Restaurant <SortArrow col="name" />
            </th>
            <th style={{ ...thStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: 90 }} onClick={() => handleSort('foods')}>
              Foods <SortArrow col="foods" />
            </th>
            <th style={{ ...thStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: 180 }} onClick={() => handleSort('avg')}>
              Avg rating <SortArrow col="avg" />
            </th>
            <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((rest, i) => {
            const avg = restAvgMap.get(rest.id) ?? null
            const isOpen = expanded === rest.id
            const isEditing = editingId === rest.id
            const isDelConfirm = deletingRestaurant === rest.id
            const restEntries = entriesByRestaurantId.get(rest.id) ?? []
            const interactive = !isEditing && !isDelConfirm
            const { bg, text } = AVATAR_COLORS[i % 5]

            return (
              <Fragment key={rest.id}>
                <tr
                  onClick={interactive ? () => setExpanded(isOpen ? null : rest.id) : undefined}
                  style={{ borderBottom: '1px solid var(--line)', cursor: interactive ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (interactive) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--paper-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                >
                  {/* Chevron */}
                  <td style={{ ...tdStyle, width: 28, paddingRight: 0 }}>
                    <span style={{
                      display: 'inline-flex',
                      color: isOpen ? 'var(--accent)' : 'var(--ink-mute)',
                      transition: 'transform 0.18s',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}>
                      <ChevronIcon open={false} />
                    </span>
                  </td>

                  {/* # */}
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {i + 1}
                  </td>

                  {/* Restaurant name */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <input
                        value={renameValue}
                        onChange={e => { setRenameValue(e.target.value); setRenameError('') }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (!renameValue.trim()) { setRenameError('Name is required'); return }
                            doRename({ id: rest.id, name: renameValue.trim() })
                          }
                          if (e.key === 'Escape') { setEditingId(null); setRenameError('') }
                        }}
                        autoFocus
                        style={inputStyle}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: bg,
                          color: text,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          flexShrink: 0,
                          userSelect: 'none',
                        }}>
                          {getInitials(rest.name)}
                        </div>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}>
                          {rest.name}
                        </span>
                      </div>
                    )}
                    {renameError && <p style={renameErrorStyle}>{renameError}</p>}
                  </td>

                  {/* Foods */}
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', fontSize: '0.82rem' }}>
                    {rest.entryCount}
                  </td>

                  {/* Avg rating */}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {avg !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <div style={{ width: 80, height: 5, borderRadius: 3, background: 'var(--line)', flexShrink: 0, overflow: 'hidden' }}>
                          <div style={{ width: `${(avg / 10) * 100}%`, height: '100%', borderRadius: 3, background: scoreColor(avg) }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.88rem', color: scoreColor(avg), minWidth: 38, textAlign: 'right' }}>
                          {avg.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-mute)' }}>—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ ...tdStyle, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            if (!renameValue.trim()) { setRenameError('Name is required'); return }
                            doRename({ id: rest.id, name: renameValue.trim() })
                          }}
                          disabled={isRenaming}
                          style={{ ...smallPrimaryBtnStyle, opacity: isRenaming ? 0.6 : 1 }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setRenameError('') }}
                          disabled={isRenaming}
                          style={smallSecondaryBtnStyle}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setRenameValue(rest.name); setRenameError(''); setEditingId(rest.id) }}
                          title="Edit restaurant name"
                          className="icon-btn"
                          style={iconBtnStyle}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => setDeletingRestaurant(rest.id)}
                          title="Delete restaurant"
                          className="icon-btn-danger"
                          style={{ ...iconBtnStyle, color: 'var(--danger)' }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                {/* Expanded entries */}
                {isOpen && restEntries.length > 0 && (
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td colSpan={6} style={{ padding: '8px 16px 12px 16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid var(--line)' }}>
                        <tbody>
                          {restEntries.map(e => {
                            const rating = latestRating(e.reviews)
                            return (
                              <tr
                                key={e.id}
                                onClick={() => navigate(`/entries/${e.id}`, { state: { background: location } })}
                                style={{ cursor: 'pointer', background: e.starred ? 'var(--gold-wash)' : 'transparent' }}
                                onMouseEnter={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = e.starred ? 'var(--gold-wash)' : 'var(--paper-2)' }}
                                onMouseLeave={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = e.starred ? 'var(--gold-wash)' : 'transparent' }}
                              >
                                <td style={{ padding: '5px 8px', width: 24 }}>
                                  {e.flag && <FlagImage code={e.flag} />}
                                </td>
                                <td style={{ padding: '5px 8px', fontSize: 13, color: e.starred ? 'var(--gold)' : 'var(--ink)' }}>
                                  {e.starred && <span style={{ marginRight: '0.25rem', fontSize: '0.75rem' }}>⭐</span>}
                                  {e.foodName}
                                </td>
                                <td style={{ padding: '5px 8px' }}>
                                  <span style={{
                                    fontSize: 11,
                                    color: 'var(--ink-mute)',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--line)',
                                    borderRadius: 99,
                                    padding: '2px 8px',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {e.category}
                                  </span>
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 13, color: rating !== null ? scoreColor(rating) : 'var(--ink-mute)', minWidth: 36 }}>
                                  {rating !== null ? rating.toFixed(1) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}

                {/* Delete confirmation */}
                {isDelConfirm && (
                  <tr style={{ background: rest.entryCount > 0 ? 'var(--gold-wash)' : '#2a1515', borderBottom: '1px solid var(--line)' }}>
                    <td colSpan={6} style={{ padding: '0.6rem 0.875rem' }}>
                      {rest.entryCount > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                          <span style={{ flex: 1, color: 'var(--gold)' }}>
                            Cannot delete: {rest.entryCount} {rest.entryCount === 1 ? 'entry' : 'entries'} assigned. Reassign or delete them first.
                          </span>
                          <button onClick={() => setDeletingRestaurant(null)} style={smallSecondaryBtnStyle}>Close</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                          <span style={{ flex: 1, color: '#fca5a5' }}>Delete this restaurant?</span>
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
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {sorted.length === 0 && search && (
        <p style={{ color: 'var(--ink-mute)', fontSize: '0.9rem', marginTop: '1rem' }}>
          No restaurants match "{search}".
        </p>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.55rem 0.875rem',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const tdStyle: React.CSSProperties = {
  padding: '0.7rem 0.875rem',
  verticalAlign: 'middle',
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
}

const renameErrorStyle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '0.8rem',
  color: 'var(--danger)',
  fontFamily: 'var(--font-body)',
}
