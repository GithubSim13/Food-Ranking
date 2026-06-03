import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCategories, renameCategory, deleteCategory } from '../../api/categories'
import { getEntries } from '../../api/entries'
import { useToast } from '../../context/ToastContext'
import type { Entry } from '../../types'

function sortByDateDesc<T extends { date: string | null }>(reviews: T[]): T[] {
  return [...reviews].map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (a.r.date && b.r.date) {
        const diff = new Date(b.r.date).getTime() - new Date(a.r.date).getTime()
        return diff !== 0 ? diff : b.i - a.i
      }
      if (a.r.date) return -1
      if (b.r.date) return 1
      return b.i - a.i
    })
    .map(({ r }) => r)
}

function latestRating(reviews: Entry['reviews']): number | null {
  return sortByDateDesc(reviews).find(r => r.overallRating !== null)?.overallRating ?? null
}

function scoreColor(v: number): string {
  return `oklch(0.62 0.16 ${25 + ((v - 3) / 6.5) * 120})`
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  )
}

export default function CategoriesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const { data: allEntries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  const [search, setSearch] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null)

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

  const categoryAvgMap = new Map<string, number | null>()
  categories.forEach(cat => {
    const ratings = allEntries
      .filter(e => e.category === cat.name)
      .map(e => latestRating(e.reviews))
      .filter((r): r is number => r !== null)
    categoryAvgMap.set(cat.name, ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null)
  })

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 960 }}>
      <p style={kickerStyle}>Browse by</p>
      <h2 style={{ ...pageTitleStyle, marginBottom: '1.25rem' }}>Categories</h2>

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none', display: 'flex' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '0.875rem' }}>
        {filtered.map(cat => {
          const avg = categoryAvgMap.get(cat.name) ?? null
          const isEditing = editingCategory === cat.name
          const isDelConfirm = deletingCategory === cat.name

          return (
            <div key={cat.name}>
              <div style={{
                background: 'var(--surface)',
                border: `1px solid ${isDelConfirm ? 'var(--line)' : 'var(--line)'}`,
                borderRadius: 14,
                padding: '1rem 1.125rem',
                position: 'relative',
                minHeight: 80,
              }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => doRename({ from: cat.name, to: renameValue.trim() })}
                        disabled={isRenaming || !renameValue.trim()}
                        style={{ ...smallPrimaryBtnStyle, flex: 1, opacity: isRenaming ? 0.6 : 1 }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        disabled={isRenaming}
                        style={{ ...smallSecondaryBtnStyle, flex: 1 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', display: 'flex', gap: '0.2rem' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setRenameValue(cat.name); setEditingCategory(cat.name) }}
                        title="Rename"
                        style={iconBtnStyle}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingCategory(cat.name) }}
                        title="Delete"
                        style={{ ...iconBtnStyle, color: '#f87171' }}
                      >
                        <TrashIcon />
                      </button>
                    </div>

                    <div onClick={() => navigate(`/rankings?category=${encodeURIComponent(cat.name)}`)} style={{ cursor: 'pointer', paddingRight: '3.5rem' }}>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: 'var(--ink)',
                        lineHeight: 1.25,
                        marginBottom: '0.75rem',
                        wordBreak: 'break-word',
                      }}>
                        {cat.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)' }}>
                          {cat.entryCount} {cat.entryCount === 1 ? 'entry' : 'entries'}
                        </span>
                        {avg !== null ? (
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: scoreColor(avg),
                          }}>
                            {avg.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)' }}>
                            Unrated
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {isDelConfirm && (
                <div style={{
                  marginTop: '0.3rem',
                  padding: '0.6rem 0.875rem',
                  background: cat.entryCount > 0 ? 'var(--gold-wash)' : '#2a1515',
                  border: `1px solid ${cat.entryCount > 0 ? 'var(--gold)' : '#7f1d1d'}`,
                  borderRadius: 8,
                  fontSize: '0.82rem',
                }}>
                  {cat.entryCount > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ flex: 1, color: 'var(--gold)' }}>
                        Cannot delete: {cat.entryCount} {cat.entryCount === 1 ? 'entry' : 'entries'} assigned.
                      </span>
                      <button onClick={() => setDeletingCategory(null)} style={smallSecondaryBtnStyle}>Close</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && search && (
        <p style={{ color: 'var(--ink-mute)', fontSize: '0.9rem', marginTop: '1rem' }}>
          No categories match "{search}".
        </p>
      )}
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
  width: '100%',
  padding: '0.3rem 0.6rem',
  border: '1px solid var(--line)',
  borderRadius: 6,
  fontSize: '0.88rem',
  background: 'var(--paper)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0.25rem',
  borderRadius: 5,
  cursor: 'pointer',
  color: 'var(--ink-mute)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}

const smallPrimaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--accent-ink)',
  border: 'none',
  padding: '0.3rem 0.7rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.78rem',
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
  fontSize: '0.78rem',
  fontWeight: 600,
  flexShrink: 0,
}
