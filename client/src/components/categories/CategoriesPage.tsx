import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getCategories, renameCategory, deleteCategory } from '../../api/categories'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'
import { useToast } from '../../context/ToastContext'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })
  const { data: allEntries = [] } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  const { showToast } = useToast()
  const [selected, setSelected] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null)

  const { mutate: doRename, isPending: isRenaming } = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => renameCategory(from, to),
    onSuccess: (_data, { from, to }) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      if (selected === from) setSelected(to)
      setEditingCategory(null)
      showToast('Category renamed')
    },
    onError: () => {
      showToast('Failed to rename category', 'error')
    },
  })

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (name: string) => deleteCategory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      showToast('Category deleted')
      setDeletingCategory(null)
    },
    onError: () => {
      showToast('Failed to delete category', 'error')
      setDeletingCategory(null)
    },
  })

  const startRename = (name: string) => {
    setRenameValue(name)
    setEditingCategory(name)
  }

  const categoryEntries = selected
    ? allEntries.filter(e => e.category === selected)
    : []

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 600 }}>
      <p style={kickerStyle}>Browse by</p>
      <h2 style={{ ...pageTitleStyle, marginBottom: '1.5rem' }}>Categories</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {categories.map(cat => (
          <div key={cat.name}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.875rem',
              background: selected === cat.name ? 'var(--accent-wash)' : 'var(--surface)',
              border: selected === cat.name ? '1px solid var(--accent)' : '1px solid var(--line)',
              borderRadius: 12,
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
                    style={{ ...smallPrimaryBtnStyle, opacity: isRenaming ? 0.6 : 1 }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    disabled={isRenaming}
                    style={smallSecondaryBtnStyle}
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
                    <span style={{ fontWeight: 500, color: selected === cat.name ? 'var(--accent)' : 'var(--ink)' }}>
                      {cat.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-mute)', flexShrink: 0 }}>
                      {cat.entryCount}
                    </span>
                  </button>
                  <button onClick={() => startRename(cat.name)} style={smallSecondaryBtnStyle}>
                    Rename
                  </button>
                  <button onClick={() => setDeletingCategory(cat.name)} style={smallSecondaryBtnStyle}>
                    Delete
                  </button>
                </>
              )}
            </div>

            {deletingCategory === cat.name && (
              <div style={{ marginTop: '0.25rem', padding: '0.5rem 0.875rem', background: cat.entryCount > 0 ? 'var(--gold-wash)' : '#2a1515', border: `1px solid ${cat.entryCount > 0 ? 'var(--gold)' : '#7f1d1d'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                {cat.entryCount > 0 ? (
                  <>
                    <span style={{ flex: 1, color: 'var(--gold)' }}>
                      Cannot delete: this category has {cat.entryCount} {cat.entryCount === 1 ? 'entry' : 'entries'} assigned to it.
                    </span>
                    <button onClick={() => setDeletingCategory(null)} style={smallSecondaryBtnStyle}>Close</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, color: '#fca5a5' }}>Delete this category?</span>
                    <button
                      onClick={() => doDelete(cat.name)}
                      disabled={isDeleting}
                      style={{ ...smallDeleteBtnStyle, opacity: isDeleting ? 0.6 : 1 }}
                    >
                      {isDeleting ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button onClick={() => setDeletingCategory(null)} disabled={isDeleting} style={smallSecondaryBtnStyle}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}

            {selected === cat.name && categoryEntries.length > 0 && (
              <div style={{ marginTop: '0.375rem', marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {categoryEntries.map(e => (
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
                    <span style={{ fontSize: '0.8rem', color: 'var(--ink-mute)' }}>{e.restaurant.name}</span>
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
