import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRestaurants, patchRestaurant } from '../../api/restaurants'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'

export default function RestaurantsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

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

  const { mutate: doRename, isPending: isRenaming } = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => patchRestaurant(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setEditingId(null)
    },
  })

  const startRename = (id: number, name: string) => {
    setRenameValue(name)
    setEditingId(id)
  }

  const restaurantEntries = selected !== null
    ? allEntries.filter(e => e.restaurantId === selected)
    : []

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Restaurants</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {restaurants.map(rest => (
          <div key={rest.id}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.875rem',
              background: selected === rest.id ? '#eff6ff' : '#fff',
              border: selected === rest.id ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
              borderRadius: 8,
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
                    style={{ ...smallSaveBtnStyle, opacity: isRenaming ? 0.6 : 1 }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    disabled={isRenaming}
                    style={smallCancelBtnStyle}
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
                    <span style={{ fontWeight: 500, color: selected === rest.id ? '#1d4ed8' : '#111827' }}>
                      {rest.name}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af', flexShrink: 0 }}>
                      {rest.entryCount} {rest.entryCount === 1 ? 'entry' : 'entries'}
                    </span>
                  </button>
                  <button onClick={() => startRename(rest.id, rest.name)} style={editBtnStyle}>
                    Rename
                  </button>
                </>
              )}
            </div>

            {selected === rest.id && restaurantEntries.length > 0 && (
              <div style={{ marginTop: '0.375rem', marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {restaurantEntries.map(e => (
                  <div
                    key={e.id}
                    onClick={() => navigate(`/entries/${e.id}`, { state: { background: location } })}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: e.starred ? '#FEF3C7' : '#f9fafb',
                      border: e.starred ? '1px solid #F59E0B' : '1px solid #e5e7eb',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FlagImage code={e.flag} />
                      {e.foodName}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{e.category}</span>
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

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.3rem 0.6rem',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  fontSize: '0.9rem',
}
const editBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  padding: '0.2rem 0.6rem',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.75rem',
  flexShrink: 0,
}
const smallSaveBtnStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.3rem 0.7rem',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
  flexShrink: 0,
}
const smallCancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  padding: '0.3rem 0.7rem',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: '0.8rem',
  flexShrink: 0,
}
