import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
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
import { bulkMoveEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'
import { useToast } from '../../context/ToastContext'
import { SearchAndScopeBar, matchesScope } from '../common/SearchAndScopeBar'
import type { Scope } from '../common/SearchAndScopeBar'
import type { RankedEntry } from '../../types'
import { kickerStyle, pageTitleStyle, smallPrimaryBtnStyle, smallSecondaryBtnStyle } from '../common/pageStyles'

// ─── sort helpers ─────────────────────────────────────────────────────────────

function sortedRated(entries: RankedEntry[]): RankedEntry[] {
  return [...entries]
    .filter(e => e.avgRating !== null)
    .sort((a, b) => b.avgRating! - a.avgRating!)
}

function sortedUnrated(entries: RankedEntry[]): RankedEntry[] {
  return [...entries]
    .filter(e => e.avgRating === null)
    .sort((a, b) => {
      if (a.manualRank !== null && b.manualRank !== null) return a.manualRank - b.manualRank
      if (a.manualRank !== null) return -1
      if (b.manualRank !== null) return 1
      return a.foodName.localeCompare(b.foodName)
    })
}

// ─── rated row ────────────────────────────────────────────────────────────────

interface RatedEntryRowProps {
  entry: RankedEntry
  index: number
  isMoveMode?: boolean
  isSourceCategory?: boolean
  isSelected?: boolean
  isWiggling?: boolean
  onToggleSelect?: (id: number) => void
}

function RatedEntryRow({
  entry,
  index,
  isMoveMode = false,
  isSourceCategory = false,
  isSelected = false,
  isWiggling = false,
  onToggleSelect,
}: RatedEntryRowProps) {
  const navigate = useNavigate()
  const location = useLocation()

  function handleClick() {
    if (isMoveMode && isSourceCategory) {
      onToggleSelect?.(entry.id)
    } else if (!isMoveMode) {
      navigate(`/entries/${entry.id}`, { state: { background: location } })
    }
  }

  const bg = isMoveMode && isSourceCategory && isSelected
    ? 'var(--accent-wash)'
    : entry.starred ? 'var(--gold-wash)' : 'var(--surface)'
  const border = isMoveMode && isSourceCategory && isSelected
    ? '1px solid var(--accent)'
    : entry.starred ? '1px solid var(--gold)' : '1px solid var(--line)'

  return (
    <div
      onClick={handleClick}
      style={{
        background: bg,
        border,
        borderRadius: 14,
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        cursor: isMoveMode ? (isSourceCategory ? 'pointer' : 'default') : 'pointer',
        userSelect: 'none',
        opacity: isMoveMode && !isSourceCategory ? 0.4 : 1,
        pointerEvents: isMoveMode && !isSourceCategory ? 'none' : 'auto',
        animation: isWiggling ? 'rankingWiggle 0.3s ease-in-out' : undefined,
      }}
    >
      <span style={{ width: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-mute)', flexShrink: 0, fontSize: '0.8rem' }}>
        {index + 1}
      </span>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: entry.starred ? 'var(--gold)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <FlagImage code={entry.flag} />
          {entry.foodName}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)' }}>{entry.restaurant}</div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>
          {entry.starred && <span style={{ fontSize: '0.85rem', color: 'var(--gold)' }}>★</span>}
          {entry.avgRating!.toFixed(2)}
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

// ─── sortable row ─────────────────────────────────────────────────────────────

interface SortableEntryRowProps {
  entry: RankedEntry
  index: number
  isEditing: boolean
  isMoveMode?: boolean
  isSourceCategory?: boolean
  isSelected?: boolean
  isWiggling?: boolean
  onToggleSelect?: (id: number) => void
}

function SortableEntryRow({
  entry,
  index,
  isEditing,
  isMoveMode = false,
  isSourceCategory = false,
  isSelected = false,
  isWiggling = false,
  onToggleSelect,
}: SortableEntryRowProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  })

  function handleClick() {
    if (isMoveMode && isSourceCategory) {
      onToggleSelect?.(entry.id)
    } else if (!isEditing && !isMoveMode) {
      navigate(`/entries/${entry.id}`, { state: { background: location } })
    }
  }

  const bg = isMoveMode && isSourceCategory && isSelected
    ? 'var(--accent-wash)'
    : entry.starred ? 'var(--gold-wash)' : 'var(--surface)'
  const border = isMoveMode && isSourceCategory && isSelected
    ? '1px solid var(--accent)'
    : entry.starred ? '1px solid var(--gold)' : '1px solid var(--line)'

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (isMoveMode && !isSourceCategory ? 0.4 : 1),
    background: bg,
    border,
    borderRadius: 14,
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    userSelect: 'none',
    cursor: isMoveMode ? (isSourceCategory ? 'pointer' : 'default') : (isEditing ? 'default' : 'pointer'),
    pointerEvents: isMoveMode && !isSourceCategory ? 'none' : 'auto',
    animation: isWiggling ? 'rankingWiggle 0.3s ease-in-out' : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} onClick={handleClick}>
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

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: entry.starred ? 'var(--gold)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <FlagImage code={entry.flag} />
          {entry.foodName}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)' }}>{entry.restaurant}</div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink-mute)' }}>
          Unrated
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

// ─── category section ─────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: string
  ratedEntries: RankedEntry[]
  unratedEntries: RankedEntry[]
  isEditing: boolean
  onReorder: (category: string, newEntries: RankedEntry[]) => void
  isMoveMode: boolean
  moveSourceCategory: string | null
  selectedEntryIds: Set<number>
  onToggleSelect: (id: number) => void
  wiggleId: number | null
}

function CategorySection({
  category,
  ratedEntries,
  unratedEntries,
  isEditing,
  onReorder,
  isMoveMode,
  moveSourceCategory,
  selectedEntryIds,
  onToggleSelect,
  wiggleId,
}: CategorySectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const isSourceCategory = category === moveSourceCategory

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = unratedEntries.findIndex(e => e.id === active.id)
    const newIndex = unratedEntries.findIndex(e => e.id === over.id)
    onReorder(category, arrayMove(unratedEntries, oldIndex, newIndex))
  }

  return (
    <section>
      <h3
        data-category={category}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: isMoveMode && isSourceCategory ? 'var(--accent)' : 'var(--ink-mute)',
          marginBottom: '0.625rem',
          opacity: 0.8,
          position: 'sticky',
          top: 'calc(var(--search-bar-height, 80px) - 2rem)',
          zIndex: 9,
          background: 'var(--paper)',
          paddingTop: '0.25rem',
          transition: 'color 0.2s',
        }}
      >
        {category}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {ratedEntries.map((entry, i) => (
          <RatedEntryRow
            key={entry.id}
            entry={entry}
            index={i}
            isMoveMode={isMoveMode}
            isSourceCategory={isSourceCategory}
            isSelected={selectedEntryIds.has(entry.id)}
            isWiggling={wiggleId === entry.id}
            onToggleSelect={onToggleSelect}
          />
        ))}
        {unratedEntries.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={unratedEntries.map(e => e.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {unratedEntries.map((entry, i) => (
                  <SortableEntryRow
                    key={entry.id}
                    entry={entry}
                    index={ratedEntries.length + i}
                    isEditing={isEditing}
                    isMoveMode={isMoveMode}
                    isSourceCategory={isSourceCategory}
                    isSelected={selectedEntryIds.has(entry.id)}
                    isWiggling={wiggleId === entry.id}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function RankingsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['rankings'],
    queryFn: getRankings,
  })

  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('category') ?? '')
  const [scope, setScope] = useState<Scope>('all')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [localOrder, setLocalOrder] = useState<Record<string, RankedEntry[]>>({})
  const [snapshot, setSnapshot] = useState<Record<string, RankedEntry[]>>({})

  // Move mode state
  const activeCategoryRef = useRef<string | null>(null)
  const [activeCategoryDisplay, setActiveCategoryDisplay] = useState<string | null>(null)
  const [isMoveMode, setIsMoveMode] = useState(false)
  const [moveSourceCategory, setMoveSourceCategory] = useState<string | null>(null)
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set())
  const [newCategoryName, setNewCategoryName] = useState('')
  const [wiggleId, setWiggleId] = useState<number | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  useEffect(() => {
    if (!isEditing && rankings) {
      setLocalOrder(
        Object.fromEntries(
          Object.entries(rankings).map(([cat, entries]) => [cat, sortedUnrated(entries)])
        )
      )
    }
  }, [rankings, isEditing])

  // Track which category header is currently scrolled past
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    function handleScroll() {
      const stickyBarHeight = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--search-bar-height') || '80'
      )
      const headers = Array.from(document.querySelectorAll<HTMLElement>('[data-category]'))
      let last: string | null = null
      for (const h of headers) {
        if (h.getBoundingClientRect().top <= stickyBarHeight + 32) {
          last = h.dataset.category ?? null
        }
      }
      activeCategoryRef.current = last
      setActiveCategoryDisplay(last)
    }

    const timer = setTimeout(handleScroll, 100)
    main.addEventListener('scroll', handleScroll)
    return () => {
      clearTimeout(timer)
      main.removeEventListener('scroll', handleScroll)
    }
  }, [])

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

  function enterMoveMode() {
    if (isEditing) cancelEdit()
    setMoveSourceCategory(activeCategoryRef.current)
    setSelectedEntryIds(new Set())
    setNewCategoryName('')
    setIsMoveMode(true)
  }

  function exitMoveMode() {
    setIsMoveMode(false)
    setMoveSourceCategory(null)
    setSelectedEntryIds(new Set())
    setNewCategoryName('')
  }

  function handleToggleSelect(id: number) {
    setSelectedEntryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (prev.size === 0) {
          setWiggleId(id)
          setTimeout(() => setWiggleId(null), 350)
        }
        next.add(id)
      }
      return next
    })
  }

  async function confirmMove() {
    const trimmed = newCategoryName.trim()
    if (trimmed === moveSourceCategory) {
      showToast('Destination must be different from the source category', 'error')
      return
    }
    setIsMoving(true)
    try {
      const ids = [...selectedEntryIds]
      await bulkMoveEntries({ entryIds: ids, category: trimmed })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      showToast(`Moved ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} to "${trimmed}"`)
      exitMoveMode()
    } catch {
      showToast('Failed to move entries', 'error')
    } finally {
      setIsMoving(false)
    }
  }

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>

  const categoryKeys = Object.keys(rankings ?? {}).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  const displayCategories = categoryKeys
    .map(cat => {
      const all = (rankings ?? {})[cat] ?? []
      return {
        category: cat,
        ratedEntries: sortedRated(all),
        unratedEntries: cat in localOrder ? localOrder[cat] : sortedUnrated(all),
      }
    })
    .filter(c => c.ratedEntries.length > 0 || c.unratedEntries.length > 0)

  if (displayCategories.length === 0) {
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

  const q = search.toLowerCase()
  const wordRe = q.length > 0
    ? new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    : null

  function matchesEntry(entry: RankedEntry): boolean {
    if (q.length > 0) {
      const hit =
        entry.foodName.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.restaurant.toLowerCase().includes(q) ||
        (wordRe != null && entry.reviews.some(r => r.notes != null && wordRe.test(r.notes)))
      if (!hit) return false
    }
    return matchesScope(entry, scope)
  }

  function prioritySort(arr: RankedEntry[]): RankedEntry[] {
    if (wordRe === null) return arr
    const isP1 = (e: RankedEntry) =>
      wordRe.test(e.foodName) || wordRe.test(e.category) || wordRe.test(e.restaurant) ||
      e.reviews.some(r => r.notes != null && wordRe.test(r.notes))
    return [...arr.filter(isP1), ...arr.filter(e => !isP1(e))]
  }

  const filteredCategories = displayCategories
    .map(({ category, ratedEntries, unratedEntries }) => ({
      category,
      ratedEntries: prioritySort(ratedEntries.filter(matchesEntry)),
      unratedEntries: prioritySort(unratedEntries.filter(matchesEntry)),
    }))
    .filter(c => c.ratedEntries.length > 0 || c.unratedEntries.length > 0)

  const hasUnrated = displayCategories.some(c => c.unratedEntries.length > 0)

  const totalEntriesInMoveSource = moveSourceCategory
    ? (displayCategories.find(c => c.category === moveSourceCategory)?.ratedEntries.length ?? 0) +
      (displayCategories.find(c => c.category === moveSourceCategory)?.unratedEntries.length ?? 0)
    : 0

  const canConfirmMove = selectedEntryIds.size > 0 && newCategoryName.trim() !== '' && !isMoving

  const moveModeMiddleContent = isMoveMode ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
      <span style={{ color: 'var(--ink-mute)', fontSize: '0.8rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
        ← {moveSourceCategory}
      </span>
      <input
        autoFocus
        value={newCategoryName}
        onChange={e => setNewCategoryName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && canConfirmMove) confirmMove() }}
        placeholder="New category name…"
        style={{
          flex: 1,
          minWidth: 0,
          padding: '0.3rem 0.6rem',
          border: '1px solid var(--line)',
          borderRadius: 6,
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontSize: '0.85rem',
          outline: 'none',
        }}
      />
      <button
        onClick={confirmMove}
        disabled={!canConfirmMove}
        style={{
          ...smallPrimaryBtnStyle,
          opacity: canConfirmMove ? 1 : 0.4,
          cursor: canConfirmMove ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
        }}
      >
        {isMoving ? 'Moving…' : `Move ${selectedEntryIds.size} ${selectedEntryIds.size === 1 ? 'entry' : 'entries'}`}
      </button>
      <button onClick={exitMoveMode} style={{ ...smallSecondaryBtnStyle, whiteSpace: 'nowrap' }}>
        Cancel
      </button>
    </div>
  ) : undefined

  const rightSlotContent = !isMoveMode ? (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {hasUnrated && (
        isEditing ? (
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
          <button onClick={enterEdit} style={secondaryBtnStyle}>Edit Rankings</button>
        )
      )}
      <button
        onClick={enterMoveMode}
        disabled={activeCategoryDisplay === null}
        style={{
          ...secondaryBtnStyle,
          opacity: activeCategoryDisplay === null ? 0.4 : 1,
          cursor: activeCategoryDisplay === null ? 'default' : 'pointer',
          pointerEvents: activeCategoryDisplay === null ? 'none' : 'auto',
        }}
      >
        Move Entries
      </button>
    </div>
  ) : undefined

  return (
    <div>
      <style>{`
        @keyframes rankingWiggle {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
      `}</style>

      <div style={{ marginBottom: '0.5rem' }}>
        <p style={kickerStyle}>The board</p>
        <h2 style={pageTitleStyle}>Rankings</h2>
      </div>

      <SearchAndScopeBar
        search={search}
        onSearchChange={setSearch}
        scope={scope}
        onScopeChange={setScope}
        searchPlaceholder="Search by name, category, restaurant, or notes…"
        middleContent={moveModeMiddleContent}
        rightSlot={rightSlotContent}
      />

      {isMoveMode && moveSourceCategory && selectedEntryIds.size > 0 && selectedEntryIds.size >= totalEntriesInMoveSource && (
        <div style={{
          color: 'var(--badge-never-again)',
          fontSize: '0.8rem',
          marginBottom: '0.75rem',
          marginTop: '-0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
        }}>
          ⚠ Moving all entries will delete the "{moveSourceCategory}" category.
        </div>
      )}

      {isEditing && !isMoveMode && (
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
          Drag unrated entries to reorder within each category
        </div>
      )}

      {filteredCategories.length === 0 && (search.length > 0 || scope !== 'all') && (
        <p style={{ color: 'var(--ink-mute)', marginTop: '0.5rem' }}>No entries match your search.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {filteredCategories.map(({ category, ratedEntries, unratedEntries }) => (
          <CategorySection
            key={category}
            category={category}
            ratedEntries={ratedEntries}
            unratedEntries={unratedEntries}
            isEditing={isEditing}
            onReorder={handleReorder}
            isMoveMode={isMoveMode}
            moveSourceCategory={moveSourceCategory}
            selectedEntryIds={selectedEntryIds}
            onToggleSelect={handleToggleSelect}
            wiggleId={wiggleId}
          />
        ))}
      </div>
    </div>
  )
}

// ─── style constants ──────────────────────────────────────────────────────────

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
