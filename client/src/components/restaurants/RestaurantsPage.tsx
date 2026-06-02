import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRestaurants, patchRestaurant, deleteRestaurant } from '../../api/restaurants'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'
import { useToast } from '../../context/ToastContext'

export default function RestaurantsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['restaurants'],
    queryFn: getRestaurants,
  })
  const { data: allEntries = [] } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  const [selected, setSelected] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingRestaurant, setDeletingRestaurant] = useState<number | null>(null)

  const { mutate: doRename, isPending: isRenaming } = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => patchRestaurant(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setEditingId(null)
      showToast('Restaurant renamed')
    },
    onError: () => {
      showToast('Failed to rename restaurant', 'error')
    },
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

  const startRename = (id: number, name: string) => {
    setRenameValue(name)
    setEditingId(id)
  }

  const restaurantEntries = selected !== null
    ? allEntries.filter(e => e.restaurantId === selected)
    : []

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 600 }}>
      <p style={kickerStyle}>Where you ate</p>
      <h2 style={{ ...pageTitleStyle, marginBottom: '1.5rem' }}>Restaurants</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {restaurants.map(rest => (
          <div key={rest.id}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.875rem',
              background: selected === rest.id ? 'var(--accent-wash)' : 'var(--surface)',
              border: selected === rest.id ? '1px solid var(--accent)' : '1px solid var(--line)',
              borderRadius: 12,
            }}>
              {editingId === rest.id ? (
                <>
                  <input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') doRename({ id: rest.id, name: renameValue.trim() })
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                    style={inputStyle}
                  />
                  <button
                    onClick={() => doRename({ id: rest.id, name: renameValue.trim() })}
                    disabled={isRenaming || !renameValue.trim()}
                    style={{ ...smallPrimaryBtnStyle, opacity: isRenaming ? 0.6 : 1 }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    disabled={isRenaming}
                    style={smallSecondaryBtnStyle}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelected(selected === rest.id ? null : rest.id)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 0,
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: selected === rest.id ? 'var(--accent)' : 'var(--ink)' }}>
                      {rest.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-mute)', flexShrink: 0 }}>
                      {rest.entryCount}
                    </span>
                  </button>
                  <button onClick={() => startRename(rest.id, rest.name)} style={smallSecondaryBtnStyle}>
                    Rename
                  </button>
                  <button onClick={() => setDeletingRestaurant(rest.id)} style={smallSecondaryBtnStyle}>
                    Delete
                  </button>
                </>
              )}
            </div>

            {deletingRestaurant === rest.id && (
              <div style={{ marginTop: '0.25rem', padding: '0.5rem 0.875rem', background: rest.entryCount > 0 ? 'var(--gold-wash)' : '#2a1515', border: `1px solid ${rest.entryCount > 0 ? 'var(--gold)' : '#7f1d1d'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                {rest.entryCount > 0 ? (
                  <>
                    <span style={{ flex: 1, color: 'var(--gold)' }}>
                      Cannot delete: this restaurant has {rest.entryCount} {rest.entryCount === 1 ? 'entry' : 'entries'}. Reassign or delete them first.
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

            {selected === rest.id && restaurantEntries.length > 0 && (
              <div style={{ marginTop: '0.375rem', marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {restaurantEntries.map(e => (
                  <div
                    key={e.id}
                    onClick={() => navigate(`/entries/${e.id}`, { state: { background: location } })}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: e.starred ? 'var(--gold-wash)' : 'var(--paper)',
                      border: e.starred ? '1px solid var(--gold)' : '1px solid var(--line-soft)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: e.starred ? 'var(--gold)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FlagImage code={e.flag} />
                      {e.foodName}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--ink-mute)' }}>{e.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
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

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.3rem 0.6rem',
  border: '1px solid var(--line)',
  borderRadius: 6,
  fontSize: '0.9rem',
  background: 'var(--paper)',
  color: 'var(--ink)',
  outline: 'none',
}

const smallPrimaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--accent-ink)',
  border: 'none',
  padding: '0.3rem 0.7rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 600,
  flexShrink: 0,
}

const smallSecondaryBtnStyle: React.CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--ink-mute)',
  border: '1px solid var(--line)',
  padding: '0.2rem 0.6rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.75rem',
  flexShrink: 0,
}

const smallDeleteBtnStyle: React.CSSProperties = {
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  padding: '0.3rem 0.7rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 600,
  flexShrink: 0,
}
