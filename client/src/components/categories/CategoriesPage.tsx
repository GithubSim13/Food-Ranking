import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCategories, renameCategory } from '../../api/categories'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })
  const { data: allEntries = [] } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  const [selected, setSelected] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const { mutate: doRename, isPending: isRenaming } = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => renameCategory(from, to),
    onSuccess: (_data, { from, to }) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      if (selected === from) setSelected(to)
      setEditingCategory(null)
    },
  })

  const startRename = (name: string) => {
    setRenameValue(name)
    setEditingCategory(name)
  }

  const categoryEntries = selected
    ? allEntries.filter(e => e.category === selected)
    : []

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Categories</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {categories.map(cat => (
          <div key={cat.name}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.875rem',
              background: selected === cat.name ? '#eff6ff' : '#fff',
              border: selected === cat.name ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
              borderRadius: 8,
            }}>
              {editingCategory === cat.name ? (
                <>
                  <input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') doRename({ from: cat.name, to: renameValue.trim() })
                      if (e.key === 'Escape') setEditingCategory(null)
                    }}
                    autoFocus
                    style={inputStyle}
                  />
                  <button
                    onClick={() => doRename({ from: cat.name, to: renameValue.trim() })}
                    disabled={isRenaming || !renameValue.trim()}
                    style={{ ...smallSaveBtnStyle, opacity: isRenaming ? 0.6 : 1 }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    disabled={isRenaming}
                    style={smallCancelBtnStyle}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelected(selected === cat.name ? null : cat.name)}
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
                    <span style={{ fontWeight: 500, color: selected === cat.name ? '#1d4ed8' : '#111827' }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af', flexShrink: 0 }}>
                      {cat.entryCount} {cat.entryCount === 1 ? 'entry' : 'entries'}
                    </span>
                  </button>
                  <button onClick={() => startRename(cat.name)} style={editBtnStyle}>
                    Rename
                  </button>
                </>
              )}
            </div>

            {selected === cat.name && categoryEntries.length > 0 && (
              <div style={{ marginTop: '0.375rem', marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {categoryEntries.map(e => (
                  <div
                    key={e.id}
                    onClick={() => navigate(`/entries/${e.id}`)}
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
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{e.restaurant.name}</span>
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
