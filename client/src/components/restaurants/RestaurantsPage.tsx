import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRestaurants, patchRestaurant, deleteRestaurant } from '../../api/restaurants'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'
import { useToast } from '../../context/ToastContext'
import { latestRating, scoreColor } from '../../utils'
import { PencilIcon, TrashIcon, ChevronIcon, iconBtnStyle } from '../common/Icons'
import { kickerStyle, pageTitleStyle, smallPrimaryBtnStyle, smallSecondaryBtnStyle, smallDeleteBtnStyle } from '../common/pageStyles'

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

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 680 }}>
      <p style={kickerStyle}>Where you ate</p>
      <h2 style={{ ...pageTitleStyle, marginBottom: '1.25rem' }}>Restaurants</h2>

      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none', display: 'flex' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {filtered.map(rest => {
          const avg = restAvgMap.get(rest.id) ?? null
          const isOpen = expanded === rest.id
          const isEditing = editingId === rest.id
          const isDelConfirm = deletingRestaurant === rest.id
          const restEntries = entriesByRestaurantId.get(rest.id) ?? []

          return (
            <div key={rest.id}>
              {/* Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.625rem 0.875rem',
                background: isOpen ? 'var(--accent-wash)' : 'var(--surface)',
                border: isOpen ? '1px solid var(--accent)' : '1px solid var(--line)',
                borderRadius: isOpen && restEntries.length > 0 ? '12px 12px 0 0' : 12,
                transition: 'background 0.1s, border-color 0.1s',
              }}>
                {isEditing ? (
                  <>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
                        style={{ ...inputStyle, width: '100%' }}
                      />
                      {renameError && <p style={renameErrorStyle}>{renameError}</p>}
                    </div>
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
                  </>
                ) : (
                  <>
                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpanded(isOpen ? null : rest.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: isOpen ? 'var(--accent)' : 'var(--ink-mute)',
                        padding: '0.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ChevronIcon open={isOpen} />
                    </button>

                    {/* Name — clickable to expand */}
                    <button
                      onClick={() => setExpanded(isOpen ? null : rest.id)}
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: 0,
                        fontWeight: 500,
                        fontSize: '0.93rem',
                        color: isOpen ? 'var(--accent)' : 'var(--ink)',
                      }}
                    >
                      {rest.name}
                    </button>

                    {/* Entry count chip */}
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem',
                      color: 'var(--ink-mute)',
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      borderRadius: 20,
                      padding: '0.1rem 0.5rem',
                      flexShrink: 0,
                    }}>
                      {rest.entryCount}×
                    </span>

                    {/* Avg rating badge */}
                    {avg !== null ? (
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        color: scoreColor(avg),
                        flexShrink: 0,
                        minWidth: 32,
                        textAlign: 'right',
                      }}>
                        {avg.toFixed(1)}
                      </span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
                        —
                      </span>
                    )}

                    {/* Icon buttons */}
                    <button
                      onClick={e => { e.stopPropagation(); setRenameValue(rest.name); setRenameError(''); setEditingId(rest.id) }}
                      title="Rename"
                      style={iconBtnStyle}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeletingRestaurant(rest.id) }}
                      title="Delete"
                      style={{ ...iconBtnStyle, color: '#f87171' }}
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>

              {/* Expanded entries */}
              {isOpen && restEntries.length > 0 && (
                <div style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--accent)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  overflow: 'hidden',
                }}>
                  {restEntries.map((e, idx) => {
                    const rating = latestRating(e.reviews)
                    return (
                      <div
                        key={e.id}
                        onClick={() => navigate(`/entries/${e.id}`, { state: { background: location } })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '0.55rem 1rem',
                          cursor: 'pointer',
                          borderTop: idx === 0 ? 'none' : '1px solid var(--line-soft)',
                          background: e.starred ? 'var(--gold-wash)' : 'transparent',
                        }}
                      >
                        <FlagImage code={e.flag} />
                        <span style={{
                          flex: 1,
                          fontSize: '0.88rem',
                          fontWeight: 500,
                          color: e.starred ? 'var(--gold)' : 'var(--ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {e.starred && <span style={{ marginRight: '0.25rem', fontSize: '0.75rem' }}>⭐</span>}
                          {e.foodName}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.68rem',
                          color: 'var(--ink-mute)',
                          background: 'var(--surface)',
                          border: '1px solid var(--line)',
                          borderRadius: 4,
                          padding: '0.1rem 0.4rem',
                          flexShrink: 0,
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {e.category}
                        </span>
                        {rating !== null ? (
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            color: scoreColor(rating),
                            flexShrink: 0,
                            minWidth: 30,
                            textAlign: 'right',
                          }}>
                            {rating.toFixed(1)}
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', flexShrink: 0, minWidth: 30, textAlign: 'right' }}>
                            —
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Delete confirmation */}
              {isDelConfirm && (
                <div style={{
                  marginTop: '0.25rem',
                  padding: '0.6rem 0.875rem',
                  background: rest.entryCount > 0 ? 'var(--gold-wash)' : '#2a1515',
                  border: `1px solid ${rest.entryCount > 0 ? 'var(--gold)' : '#7f1d1d'}`,
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}>
                  {rest.entryCount > 0 ? (
                    <>
                      <span style={{ flex: 1, color: 'var(--gold)' }}>
                        Cannot delete: {rest.entryCount} {rest.entryCount === 1 ? 'entry' : 'entries'} assigned. Reassign or delete them first.
                      </span>
                      <button onClick={() => setDeletingRestaurant(null)} style={smallSecondaryBtnStyle}>Close</button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && search && (
        <p style={{ color: 'var(--ink-mute)', fontSize: '0.9rem', marginTop: '1rem' }}>
          No restaurants match "{search}".
        </p>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.3rem 0.6rem',
  border: '1px solid var(--line)',
  borderRadius: 6,
  fontSize: '0.9rem',
  background: 'var(--paper)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
}
const renameErrorStyle: React.CSSProperties = {
  margin: '0',
  fontSize: '0.8rem',
  color: '#f87171',
  fontFamily: 'var(--font-body)',
}

