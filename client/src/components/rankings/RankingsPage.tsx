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
    background: isEditing
      ? (entry.starred ? '#FEF9E7' : '#f8fafc')
      : (entry.starred ? '#FEF3C7' : '#fff'),
    border: entry.starred ? '2px solid #F59E0B' : '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: entry.starred
      ? '0 0 0 3px #FDE68A, 0 4px 12px rgba(245, 158, 11, 0.25)'
      : 'none',
    userSelect: 'none',
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
      <span
        {...(isEditing ? { ...attributes, ...listeners } : {})}
        style={{
          cursor: isEditing ? 'grab' : 'default',
          color: isEditing ? '#6b7280' : 'transparent',
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

      <span style={{ width: 24, textAlign: 'center', fontWeight: 700, color: '#9ca3af', flexShrink: 0 }}>
        {index + 1}
      </span>

      <div
        style={{ flex: 1, cursor: isEditing ? 'default' : 'pointer' }}
        onClick={isEditing ? undefined : () => navigate(`/entries/${entry.id}`, { state: { background: location } })}
      >
        <div style={{ fontWeight: 600, color: entry.starred ? '#92400E' : undefined, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <FlagImage code={entry.flag} />
          {entry.foodName}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{entry.restaurant}</div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem', fontWeight: 700, fontSize: '1.1rem', color: entry.avgRating != null ? '#2563eb' : '#9ca3af' }}>
          {entry.starred && entry.avgRating != null && <span style={{ fontSize: '0.9rem', color: '#F59E0B' }}>★</span>}
          {entry.avgRating != null ? entry.avgRating.toFixed(2) : 'Unrated'}
        </div>
        {entry.reviewCount > 0 && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
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
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#6b7280',
        marginBottom: '0.625rem',
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

  // Sync local order from server whenever data arrives (but not while editing)
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

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>

  const categories = Object.entries(localOrder)

  if (categories.length === 0) {
    return (
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Rankings</h2>
        <p style={{ color: '#6b7280' }}>
          No rankings yet. Add reviews with an Overall Rating to see entries ranked here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Rankings</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isEditing ? (
            <>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                style={{ ...btnStyle, opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={cancelEdit} disabled={isSaving} style={cancelBtnStyle}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={enterEdit} style={editBtnStyle}>
              Edit Rankings
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.6rem 0.875rem',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          fontSize: '0.85rem',
          color: '#1e40af',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
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

const btnStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.45rem 0.875rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.875rem',
}
const cancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  padding: '0.45rem 0.875rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.875rem',
}
const editBtnStyle: React.CSSProperties = {
  background: '#f9fafb',
  color: '#374151',
  border: '1px solid #d1d5db',
  padding: '0.45rem 0.875rem',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.875rem',
}
