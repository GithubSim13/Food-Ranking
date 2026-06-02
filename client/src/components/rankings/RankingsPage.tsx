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
import type { RankedEntry } from '../../types'

interface SortableEntryRowProps {
  entry: RankedEntry
  index: number
}

function SortableEntryRow({ entry, index }: SortableEntryRowProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: entry.starred ? '#FEF3C7' : '#fff',
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
      {/* Drag handle — only this receives drag listeners */}
      <span
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          color: '#9ca3af',
          fontSize: '1.1rem',
          flexShrink: 0,
          padding: '0 2px',
          touchAction: 'none',
        }}
        title="Drag to reorder"
      >
        ⠿
      </span>

      <span style={{ width: 24, textAlign: 'center', fontWeight: 700, color: '#9ca3af', flexShrink: 0 }}>
        {index + 1}
      </span>

      {/* Clickable area to open entry detail */}
      <div
        style={{ flex: 1, cursor: 'pointer' }}
        onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
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
  initialEntries: RankedEntry[]
}

function CategorySection({ category, initialEntries }: CategorySectionProps) {
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState(initialEntries)

  // Sync when server data changes
  useEffect(() => {
    setEntries(initialEntries)
  }, [initialEntries])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = entries.findIndex(e => e.id === active.id)
    const newIndex = entries.findIndex(e => e.id === over.id)
    const reordered = arrayMove(entries, oldIndex, newIndex)

    setEntries(reordered)

    try {
      await reorderCategory(category, reordered.map(e => e.id))
    } catch {
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
    }
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
              <SortableEntryRow key={entry.id} entry={entry} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}

export default function RankingsPage() {
  const { data: rankings, isLoading } = useQuery({
    queryKey: ['rankings'],
    queryFn: getRankings,
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>Loading…</p>

  const categories = rankings ? Object.entries(rankings) : []

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
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Rankings</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {categories.map(([category, entries]) => (
          <CategorySection key={category} category={category} initialEntries={entries} />
        ))}
      </div>
    </div>
  )
}
