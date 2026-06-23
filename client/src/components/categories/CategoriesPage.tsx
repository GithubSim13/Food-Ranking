import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCategories, renameCategory, deleteCategory } from '../../api/categories'
import { getEntries } from '../../api/entries'
import { useToast } from '../../context/ToastContext'
import { latestRating, scoreColor } from '../../utils'
import { PencilIcon, TrashIcon, iconBtnStyle } from '../common/Icons'
import { kickerStyle, pageTitleStyle, smallPrimaryBtnStyle, smallSecondaryBtnStyle, smallDeleteBtnStyle } from '../common/pageStyles'

type SortCol = 'name' | 'entries' | 'avg'
type SortDir = 'asc' | 'desc'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const { data: allEntries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  const [search, setSearch] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { mutate: doRename, isPending: isRenaming } = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => renameCategory(from, to),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setEditingCategory(null)
      showToast('Category renamed')
    },
    onError: () => showToast('Failed to rename category', 'error'),
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

  const categoryAvgMap = useMemo(() => {
    const map = new Map<string, number | null>()
    categories.forEach(cat => {
      const ratings = allEntries
        .filter(e => e.category === cat.name)
        .map(e => latestRating(e.reviews))
        .filter((r): r is number => r !== null)
      map.set(cat.name, ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null)
    })
    return map
  }, [categories, allEntries])

  const q = search.toLowerCase()
  const filtered = categories.filter(c => c.name.toLowerCase().includes(q))

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortCol === 'entries') {
        cmp = a.entryCount - b.entryCount
      } else {
        const aAvg = categoryAvgMap.get(a.name) ?? -1
        const bAvg = categoryAvgMap.get(b.name) ?? -1
        cmp = aAvg - bAvg
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir, categoryAvgMap])

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
      <p style={kickerStyle}>Browse by</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ ...pageTitleStyle, marginBottom: 0 }}>Categories</h2>
        <div style={{ position: 'relative', flexShrink: 0, width: 260 }}>
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories…"
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
            <th style={{ ...thStyle, width: 44, textAlign: 'center' }}>#</th>
            <th style={{ ...thStyle, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
              Category <SortArrow col="name" />
            </th>
            <th style={{ ...thStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: 90 }} onClick={() => handleSort('entries')}>
              Entries <SortArrow col="entries" />
            </th>
            <th style={{ ...thStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: 180 }} onClick={() => handleSort('avg')}>
              Avg rating <SortArrow col="avg" />
            </th>
            <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((cat, i) => {
            const avg = categoryAvgMap.get(cat.name) ?? null
            const isEditing = editingCategory === cat.name
            const isDelConfirm = deletingCategory === cat.name
            const interactive = !isEditing && !isDelConfirm

            return (
              <Fragment key={cat.name}>
                <tr
                  className={`anim-fade-slide-up anim-delay-${Math.min(i + 1, 8)}`}
                  onClick={interactive ? () => navigate(`/rankings?category=${encodeURIComponent(cat.name)}`) : undefined}
                  style={{ borderBottom: '1px solid var(--line)', cursor: interactive ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (interactive) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--paper-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                >
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {i + 1}
                  </td>
                  <td style={tdStyle}>
                    {isEditing ? (
                      <input
                        value={renameValue}
                        onChange={e => { setRenameValue(e.target.value); setRenameError('') }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (!renameValue.trim()) { setRenameError('Name is required'); return }
                            doRename({ from: cat.name, to: renameValue.trim() })
                          }
                          if (e.key === 'Escape') { setEditingCategory(null); setRenameError('') }
                        }}
                        autoFocus
                        style={inputStyle}
                      />
                    ) : (
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}>
                        {cat.name}
                      </span>
                    )}
                    {renameError && <p style={renameErrorStyle}>{renameError}</p>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', fontSize: '0.82rem' }}>
                    {cat.entryCount}
                  </td>
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
                  <td style={{ ...tdStyle, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            if (!renameValue.trim()) { setRenameError('Name is required'); return }
                            doRename({ from: cat.name, to: renameValue.trim() })
                          }}
                          disabled={isRenaming}
                          style={{ ...smallPrimaryBtnStyle, opacity: isRenaming ? 0.6 : 1 }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingCategory(null); setRenameError('') }}
                          disabled={isRenaming}
                          style={smallSecondaryBtnStyle}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setRenameValue(cat.name); setRenameError(''); setEditingCategory(cat.name) }}
                          title="Rename"
                          className="icon-btn"
                          style={iconBtnStyle}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => setDeletingCategory(cat.name)}
                          title="Delete"
                          className="icon-btn-danger"
                          style={{ ...iconBtnStyle, color: 'var(--danger)' }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                {isDelConfirm && (
                  <tr style={{ background: cat.entryCount > 0 ? 'var(--gold-wash)' : '#2a1515', borderBottom: '1px solid var(--line)' }}>
                    <td colSpan={5} style={{ padding: '0.6rem 0.875rem' }}>
                      {cat.entryCount > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                          <span style={{ flex: 1, color: 'var(--gold)' }}>
                            Cannot delete: {cat.entryCount} {cat.entryCount === 1 ? 'entry' : 'entries'} assigned.
                          </span>
                          <button onClick={() => setDeletingCategory(null)} style={smallSecondaryBtnStyle}>Close</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
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
          No categories match "{search}".
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
