import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getRankings, reorderCategory } from '../../api/rankings'
import FlagImage from '../common/FlagImage'
import { useToast } from '../../context/ToastContext'
import type { RankedEntry } from '../../types'

interface SortableEntryRowProps {
  entry: RankedEntry
  index: number
  isEditing: boolean
}

function SortableEntryRow({ entry, index, isEditing }: SortableEntryRowProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: entry.starred ? 'var(--gold-wash)' : 'var(--surface)',
    border: entry.starred ? '1px solid var(--gold)' : '1px solid var(--line)',
    borderRadius: 14,
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    userSelect: 'none',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...(isEditing ? { ...attributes, ...listeners } : {})}
        style={{
          cursor: isEditing ? 'grab' : 'default',
          color: isEditing ? 'var(--ink-mute)' : 'transparent',
          fontSize: '1.1rem',
          flexShrink: 0,
          padding: '0 2px',
          touchAction: 'none',
          transition: 'color 0.15s',
        }}
        title={isEditing ? 'Drag to reorder' : undefined}
      >
        ⠿
      </span>

      <span style={{ width: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-mute)', flexShrink: 0, fontSize: '0.8rem' }}>
        {index + 1}
      </span>

      <div
        style={{ flex: 1, cursor: isEditing ? 'default' : 'pointer' }}
        onClick={isEditing ? undefined : () => navigate(`/entries/${entry.id}`, { state: { background: location } })}
      >
        <div style={{ fontWeight: 600, color: entry.starred ? 'var(--gold)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <FlagImage code={entry.flag} />
          {entry.foodName}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)' }}>{entry.restaurant}</div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: entry.avgRating != null ? 'var(--accent)' : 'var(--ink-mute)' }}>
          {entry.starred && entry.avgRating != null && <span style={{ fontSize: '0.85rem', color: 'var(--gold)' }}>★</span>}
          {entry.avgRating != null ? entry.avgRating.toFixed(2) : 'Unrated'}
        </div>
        {entry.reviewCount > 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)' }}>
            {entry.reviewCount} review{entry.reviewCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

interface CategorySectionProps {
  category: string
  entries: RankedEntry[]
  isEditing: boolean
  onReorder: (category: string, newEntries: RankedEntry[]) => void
}

function CategorySection({ category, entries, isEditing, onReorder }: CategorySectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = entries.findIndex(e => e.id === active.id)
    const newIndex = entries.findIndex(e => e.id === over.id)
    onReorder(category, arrayMove(entries, oldIndex, newIndex))
  }

  return (
    <section>
      <h3 style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--ink-mute)',
        marginBottom: '0.625rem',
        opacity: 0.8,
      }}>
        {category}
      </h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {entries.map((entry, i) => (
              <SortableEntryRow key={entry.id} entry={entry} index={i} isEditing={isEditing} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}

export default function RankingsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['rankings'],
    queryFn: getRankings,
  })

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [localOrder, setLocalOrder] = useState<Record<string, RankedEntry[]>>({})
  const [snapshot, setSnapshot] = useState<Record<string, RankedEntry[]>>({})

  useEffect(() => {
    if (!isEditing && rankings) {
      setLocalOrder(
        Object.fromEntries(Object.entries(rankings).map(([cat, entries]) => [cat, entries]))
      )
    }
  }, [rankings, isEditing])

  function enterEdit() {
    const snap: Record<string, RankedEntry[]> = {}
    for (const [cat, entries] of Object.entries(localOrder)) {
      snap[cat] = [...entries]
    }
    setSnapshot(snap)
    setIsEditing(true)
  }

  function cancelEdit() {
    setLocalOrder(snapshot)
    setIsEditing(false)
  }

  async function saveEdit() {
    setIsSaving(true)
    try {
      const changed = Object.entries(localOrder).filter(([cat, entries]) =>
        entries.some((e, i) => e.id !== snapshot[cat]?.[i]?.id)
      )
      await Promise.all(
        changed.map(([cat, entries]) => reorderCategory(cat, entries.map(e => e.id)))
      )
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      showToast('Rankings saved')
    } catch {
      showToast('Failed to save rankings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  function handleReorder(category: string, newEntries: RankedEntry[]) {
    setLocalOrder(prev => ({ ...prev, [category]: newEntries }))
  }

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>

  const categories = Object.entries(localOrder)

  if (categories.length === 0) {
    return (
      <div>
        <p style={kickerStyle}>The board</p>
        <h2 style={{ ...pageTitleStyle, marginBottom: '1rem' }}>Rankings</h2>
        <p style={{ color: 'var(--ink-mute)' }}>
          No rankings yet. Add reviews with an Overall Rating to see entries ranked here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <p style={kickerStyle}>The board</p>
          <h2 style={pageTitleStyle}>Rankings</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          {isEditing ? (
            <>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                style={{ ...primaryBtnStyle, opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={cancelEdit} disabled={isSaving} style={secondaryBtnStyle}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={enterEdit} style={secondaryBtnStyle}>
              Edit Rankings
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.6rem 0.875rem',
          background: 'var(--accent-wash)',
          border: '1px solid var(--accent)',
          borderRadius: 10,
          fontSize: '0.85rem',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          opacity: 0.9,
        }}>
          <span>⠿</span>
          Drag entries to reorder within each category
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {categories.map(([category, entries]) => (
          <CategorySection
            key={category}
            category={category}
            entries={entries}
            isEditing={isEditing}
            onReorder={handleReorder}
          />
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

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--accent-ink)',
  border: 'none',
  padding: '0.45rem 0.875rem',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.875rem',
}

const secondaryBtnStyle: React.CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--ink-mute)',
  border: '1px solid var(--line)',
  padding: '0.45rem 0.875rem',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.875rem',
}
