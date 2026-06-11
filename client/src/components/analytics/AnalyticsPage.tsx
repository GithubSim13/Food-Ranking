import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getEntries } from '../../api/entries'
import SectionErrorBoundary from '../common/SectionErrorBoundary'
import { Card, SectionLabel, RankRow } from '../home/HomeShared'
import { pillStyle } from '../common/SearchAndScopeBar'
import { kickerStyle, pageTitleStyle, smallSecondaryBtnStyle } from '../common/pageStyles'
import { latestRating, sortReviewsByDateDesc, scoreColor, formatReviewDate } from '../../utils'
import type { Entry } from '../../types'
import FlagImage from '../common/FlagImage'
import { COUNTRIES } from '../common/countryList'
import EntryFlagBadges from '../common/EntryFlagBadges'

const COLOR_GOOD = 'var(--accent)'
const COLOR_MID = 'var(--ink-mute)'
const COLOR_BAD = '#c0392b'

function pct(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0
}

// Fires once when the element scrolls into view; callback ref so late-mounted
// elements (rendered after the entries query resolves) still get observed.
function useInViewOnce<T extends HTMLElement>(threshold = 0.3) {
  const [inView, setInView] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect()
    if (!el) return
    observerRef.current = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) {
        setInView(true)
        observerRef.current?.disconnect()
      }
    }, { threshold })
    observerRef.current.observe(el)
  }, [threshold])
  return { ref, inView }
}

function useCountUp(target: number | null, start: boolean, duration = 800): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start || target === null) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [start, target, duration])
  return value
}

function Donut({ segments, size = 110, centerTop, centerTopColor = 'var(--accent)', centerBottom }: {
  segments: { color: string; pct: number }[]
  size?: number
  centerTop?: string
  centerTopColor?: string
  centerBottom?: string
}) {
  let acc = 0
  const stops: string[] = []
  segments.forEach(s => {
    if (s.pct <= 0) return
    const start = acc
    acc += s.pct
    stops.push(`${s.color} ${start}% ${acc}%`)
  })
  const gradient = stops.length ? `conic-gradient(${stops.join(', ')})` : 'var(--line)'
  const hole = size * 0.78
  const inset = (size - hole) / 2
  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: gradient, flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: inset, left: inset, width: hole, height: hole, borderRadius: '50%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        {centerTop && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 800, color: centerTopColor, lineHeight: 1, whiteSpace: 'nowrap' as const }}>{centerTop}</span>}
        {centerBottom && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--ink-mute)', lineHeight: 1 }}>{centerBottom}</span>}
      </div>
    </div>
  )
}

function LegendRow({ color, label, pct, count }: { color: string; label: string; pct: number; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: 'var(--ink)', flex: 1 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', fontSize: '0.75rem' }}>{Math.round(pct)}% · {count}</span>
    </div>
  )
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--ink-mute)' }}>{children}</p>
}

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta > 0
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: 4,
      background: positive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
      color: positive ? '#2ecc71' : '#e74c3c',
      flexShrink: 0,
    }}>
      {positive ? '+' : '−'}{Math.abs(delta).toFixed(1)}
    </span>
  )
}

type Mover = { entry: Entry; first: number; latest: number; delta: number }
type MoverFilter = 'improved' | 'declined' | 'all'

const STARRED_PAGE_SIZE = 9
const GEMS_PAGE_SIZE = 9
const LTNS_PAGE_SIZE = 10

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function cellColor(count: number): React.CSSProperties {
  if (count === 0) return { background: 'var(--surface)', border: '1px solid var(--line)' }
  if (count === 1) return { background: 'color-mix(in srgb, var(--accent) 25%, transparent)' }
  if (count <= 3) return { background: 'color-mix(in srgb, var(--accent) 55%, transparent)' }
  return { background: 'var(--accent)' }
}

function formatHeatmapDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: entries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [moverFilter, setMoverFilter] = useState<MoverFilter>('improved')
  const [showAllMovers, setShowAllMovers] = useState(false)
  const [starredPage, setStarredPage] = useState(0)
  const [selectedYearOverride, setSelectedYearOverride] = useState<number | null>(null)
  const [heatmapTooltip, setHeatmapTooltip] = useState<{ x: number; y: number; dateStr: string; count: number } | null>(null)
  const [countrySortCol, setCountrySortCol] = useState<'country' | 'entries' | 'avg' | 'best'>('avg')
  const [countrySortDir, setCountrySortDir] = useState<'asc' | 'desc'>('desc')
  const [gemsPage, setGemsPage] = useState(0)
  const [ltnsPage, setLtnsPage] = useState(0)
  const [scatterWidth, setScatterWidth] = useState(600)
  const [hoveredDotId, setHoveredDotId] = useState<number | null>(null)
  const [scatterTooltip, setScatterTooltip] = useState<{
    x: number; y: number
    foodName: string; restaurant: string; category: string
    taste: number; consistency: number; overall: number | null
  } | null>(null)
  const scatterContainerRef = useRef<HTMLDivElement>(null)
  const [priceWidth, setPriceWidth] = useState(600)
  const [hoveredPriceDotId, setHoveredPriceDotId] = useState<number | null>(null)
  const [priceTooltip, setPriceTooltip] = useState<{
    x: number; y: number
    foodName: string; restaurant: string; category: string
    price: number; overall: number
  } | null>(null)
  const priceContainerRef = useRef<HTMLDivElement>(null)
  const pillScrollRef = useRef<HTMLDivElement>(null)
  const pillRefsMap = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [catPillScroll, setCatPillScroll] = useState({ left: false, right: true })

  // <main> in AppShell is the scroll container and persists across navigation,
  // so it retains the previous page's scroll position. Reset it on mount.
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const main = rootRef.current?.closest('main') as HTMLElement | null
    if (main) main.scrollTop = 0
  }, [])
  useEffect(() => { setStarredPage(0); setGemsPage(0); setLtnsPage(0) }, [entries])

  useEffect(() => {
    const el = scatterContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(resizeEntries => {
      if (resizeEntries[0]) setScatterWidth(resizeEntries[0].contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = priceContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(resizeEntries => {
      if (resizeEntries[0]) setPriceWidth(resizeEntries[0].contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = pillScrollRef.current
    if (!el) return
    const update = () => setCatPillScroll({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    })
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [])

  function selectMoverFilter(f: MoverFilter) {
    setMoverFilter(f)
    setShowAllMovers(false)
  }

  const totalEntries = entries.length

  // ── overview stats ─────────────────────────────────────────────────────────
  const ratedList = useMemo(() => entries
    .map(e => ({ entry: e, rating: latestRating(e.reviews) }))
    .filter((x): x is { entry: Entry; rating: number } => x.rating !== null), [entries])

  const avgRating = ratedList.length ? ratedList.reduce((s, x) => s + x.rating, 0) / ratedList.length : null
  const starredCount = entries.filter(e => e.starred).length

  // ── scroll-triggered animations ────────────────────────────────────────────
  const ratingDonutView = useInViewOnce<HTMLDivElement>(0.5)
  const starredDonutView = useInViewOnce<HTMLDivElement>(0.5)
  const topCatsView = useInViewOnce<HTMLDivElement>(0.3)
  const countryView = useInViewOnce<HTMLTableElement>(0.15)
  const gemsView = useInViewOnce<HTMLDivElement>(0.15)
  const heatmapView = useInViewOnce<HTMLDivElement>(0.3)
  const animatedAvg = useCountUp(avgRating, ratingDonutView.inView)
  const animatedStarred = useCountUp(starredCount, starredDonutView.inView)

  // ── rating distribution ────────────────────────────────────────────────────
  const distribution = useMemo(() => {
    let good = 0, mid = 0, bad = 0
    ratedList.forEach(({ rating }) => {
      if (rating >= 7) good++
      else if (rating >= 4.5) mid++
      else bad++
    })
    return { good, mid, bad, total: ratedList.length }
  }, [ratedList])

  // ── starred ratio ──────────────────────────────────────────────────────────
  const starredRatio = useMemo(() => ({
    starred: starredCount,
    unstarred: totalEntries - starredCount,
    total: totalEntries,
  }), [starredCount, totalEntries])

  // ── top categories by avg rating ───────────────────────────────────────────
  const topCategories = useMemo(() => {
    const map = new Map<string, { ratings: number[]; count: number }>()
    entries.forEach(e => {
      const bucket = map.get(e.category) ?? { ratings: [], count: 0 }
      bucket.count++
      const r = latestRating(e.reviews)
      if (r !== null) bucket.ratings.push(r)
      map.set(e.category, bucket)
    })
    return Array.from(map.entries())
      .filter(([, b]) => b.ratings.length >= 2)
      .map(([name, b]) => ({ name, count: b.count, avg: b.ratings.reduce((a, c) => a + c, 0) / b.ratings.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8)
  }, [entries])

  // ── best restaurants by avg rating ─────────────────────────────────────────
  const bestRestaurants = useMemo(() => {
    const map = new Map<number, { name: string; ratings: number[]; count: number }>()
    entries.forEach(e => {
      const bucket = map.get(e.restaurantId) ?? { name: e.restaurant.name, ratings: [], count: 0 }
      bucket.count++
      const r = latestRating(e.reviews)
      if (r !== null) bucket.ratings.push(r)
      map.set(e.restaurantId, bucket)
    })
    return Array.from(map.values())
      .filter(b => b.ratings.length >= 2)
      .map(b => ({ name: b.name, visits: b.count, avg: b.ratings.reduce((a, c) => a + c, 0) / b.ratings.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8)
  }, [entries])

  // ── most visited stores ────────────────────────────────────────────────────
  const mostVisitedStores = useMemo(() => {
    const map = new Map<number, { name: string; count: number }>()
    entries.forEach(e => {
      const b = map.get(e.restaurantId) ?? { name: e.restaurant.name, count: 0 }
      b.count++
      map.set(e.restaurantId, b)
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10)
  }, [entries])

  // ── most logged categories ─────────────────────────────────────────────────
  const mostLoggedCategories = useMemo(() => {
    const map = new Map<string, number>()
    entries.forEach(e => { map.set(e.category, (map.get(e.category) ?? 0) + 1) })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [entries])

  // ── best spot per category ─────────────────────────────────────────────────
  const catRestMap = useMemo(() => {
    const map = new Map<string, Map<number, { name: string; ratings: number[] }>>()
    entries.forEach(e => {
      const r = latestRating(e.reviews)
      if (r === null) return
      if (!map.has(e.category)) map.set(e.category, new Map())
      const restMap = map.get(e.category)!
      const bucket = restMap.get(e.restaurantId) ?? { name: e.restaurant.name, ratings: [] }
      bucket.ratings.push(r)
      restMap.set(e.restaurantId, bucket)
    })
    return map
  }, [entries])


  // ── rating trajectory ──────────────────────────────────────────────────────
  const movers = useMemo(() => {
    const list: Mover[] = []
    entries.forEach(e => {
      if (e.reviews.filter(r => r.overallRating !== null).length < 2) return
      const oldestFirst = [...sortReviewsByDateDesc(e.reviews)].reverse()
      const firstReview = oldestFirst.find(r => r.overallRating !== null)
      const latest = latestRating(e.reviews)
      if (!firstReview || firstReview.overallRating === null || latest === null) return
      const first = firstReview.overallRating
      list.push({ entry: e, first, latest, delta: latest - first })
    })
    return list
  }, [entries])

  const displayedMovers = useMemo(() => {
    if (moverFilter === 'improved') {
      return [...movers].filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10)
    }
    if (moverFilter === 'declined') {
      return [...movers].filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10)
    }
    const sorted = [...movers].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    return showAllMovers ? sorted : sorted.slice(0, 20)
  }, [movers, moverFilter, showAllMovers])

  // ── starred picks ──────────────────────────────────────────────────────────
  const starredPicks = useMemo(() => entries
    .filter(e => e.starred)
    .map(e => ({ entry: e, rating: latestRating(e.reviews) }))
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)), [entries])

  // ── logging activity ───────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    entries.forEach(e => {
      e.reviews.forEach(r => {
        if (!r.date) return
        const y = parseInt(r.date.slice(0, 4), 10)
        if (!isNaN(y)) years.add(y)
      })
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [entries])

  const selectedYear = selectedYearOverride ?? availableYears[0] ?? null

  const heatmapCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (!selectedYear) return counts
    entries.forEach(e => {
      e.reviews.forEach(r => {
        if (!r.date) return
        const dateStr = r.date.slice(0, 10)
        if (parseInt(dateStr.slice(0, 4), 10) !== selectedYear) return
        counts.set(dateStr, (counts.get(dateStr) ?? 0) + 1)
      })
    })
    return counts
  }, [entries, selectedYear])

  const heatmapGrid = useMemo(() => {
    if (!selectedYear) return { cells: [] as { dateStr: string | null; count: number }[], monthLabels: [] as { label: string; col: number }[] }
    const jan1DayOfWeek = new Date(selectedYear, 0, 1).getDay()
    const isLeap = (selectedYear % 4 === 0 && selectedYear % 100 !== 0) || selectedYear % 400 === 0
    const daysInYear = isLeap ? 366 : 365

    const cells: { dateStr: string | null; count: number }[] = []
    for (let k = 0; k < 53 * 7; k++) {
      const daysSinceJan1 = k - jan1DayOfWeek
      if (daysSinceJan1 < 0 || daysSinceJan1 >= daysInYear) {
        cells.push({ dateStr: null, count: 0 })
      } else {
        const d = new Date(selectedYear, 0, 1 + daysSinceJan1)
        const dateStr = `${selectedYear}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        cells.push({ dateStr, count: heatmapCounts.get(dateStr) ?? 0 })
      }
    }

    const monthLabels: { label: string; col: number }[] = []
    const jan1Time = new Date(selectedYear, 0, 1).getTime()
    for (let m = 0; m < 12; m++) {
      const daysSinceJan1 = Math.round((new Date(selectedYear, m, 1).getTime() - jan1Time) / 86400000)
      const col = Math.floor((daysSinceJan1 + jan1DayOfWeek) / 7)
      monthLabels.push({ label: MONTH_NAMES[m], col })
    }

    return { cells, monthLabels }
  }, [selectedYear, heatmapCounts])

  // ── long time no see ──────────────────────────────────────────────────────
  const longTimeNoSee = useMemo(() => {
    const today = new Date()
    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const result: { entry: Entry; dateStr: string; daysAgo: number }[] = []
    entries.forEach(e => {
      if (e.reviews.length !== 1) return
      const date = e.reviews[0].date
      if (!date) return
      const [y, m, d] = date.slice(0, 10).split('-').map(Number)
      const visitMs = new Date(y, m - 1, d).getTime()
      result.push({ entry: e, dateStr: date, daysAgo: Math.floor((todayMs - visitMs) / 86400000) })
    })
    return result.sort((a, b) => b.daysAgo - a.daysAgo)
  }, [entries])

  // ── score breakdown by category ───────────────────────────────────────────
  const breakdownCategories = useMemo(() => {
    const cats = new Map<string, number>()
    entries.forEach(e => {
      if (latestRating(e.reviews) !== null) cats.set(e.category, (cats.get(e.category) ?? 0) + 1)
    })
    return Array.from(cats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
  }, [entries])

  const defaultBreakdownCat = breakdownCategories.length
    ? breakdownCategories.reduce((best, c) => c.count > best.count ? c : best).name
    : null
  const effectiveCategory = activeCategory ?? defaultBreakdownCat

  // Must be placed after effectiveCategory is defined.
  // Scroll the active pill into view *horizontally within the pill strip only* —
  // scrollIntoView would also scroll the nearest vertical ancestor (<main>),
  // yanking the whole page down to the pill on mount.
  useEffect(() => {
    if (!effectiveCategory) return
    const container = pillScrollRef.current
    const pill = pillRefsMap.current.get(effectiveCategory)
    if (!container || !pill) return
    const cRect = container.getBoundingClientRect()
    const pRect = pill.getBoundingClientRect()
    if (pRect.left < cRect.left) {
      container.scrollBy({ left: pRect.left - cRect.left - 8, behavior: 'smooth' })
    } else if (pRect.right > cRect.right) {
      container.scrollBy({ left: pRect.right - cRect.right + 8, behavior: 'smooth' })
    }
  }, [effectiveCategory])

  const bestSpotList = useMemo(() => {
    if (!effectiveCategory) return []
    const restMap = catRestMap.get(effectiveCategory)
    if (!restMap) return []
    return Array.from(restMap.values())
      .filter(b => b.ratings.length >= 2)
      .map(b => ({ name: b.name, count: b.ratings.length, avg: b.ratings.reduce((a, c) => a + c, 0) / b.ratings.length }))
      .sort((a, b) => b.avg - a.avg)
  }, [catRestMap, effectiveCategory])

  const breakdownData = useMemo(() => {
    if (!effectiveCategory) return null
    const r1s: number[] = [], r2s: number[] = [], r3s: number[] = []
    entries.filter(e => e.category === effectiveCategory).forEach(e => {
      const sorted = sortReviewsByDateDesc(e.reviews)
      const lr1 = sorted.find(r => r.rating1 !== null)?.rating1 ?? null
      const lr2 = sorted.find(r => r.rating2 !== null)?.rating2 ?? null
      const lr3 = sorted.find(r => r.rating3 !== null)?.rating3 ?? null
      if (lr1 !== null) r1s.push(lr1)
      if (lr2 !== null) r2s.push(lr2)
      if (lr3 !== null) r3s.push(lr3)
    })
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    return {
      taste: { avg: avg(r1s), count: r1s.length },
      value: { avg: avg(r2s), count: r2s.length },
      consistency: { avg: avg(r3s), count: r3s.length },
    }
  }, [entries, effectiveCategory])

  // ── price vs rating scatter ───────────────────────────────────────────────
  const priceScatterData = useMemo(() => {
    const result: { entry: Entry; price: number; overall: number }[] = []
    entries.forEach(e => {
      const sorted = sortReviewsByDateDesc(e.reviews)
      const review = sorted.find(r => r.price != null && r.overallRating !== null)
      if (!review || review.price == null || review.overallRating === null) return
      result.push({ entry: e, price: review.price, overall: review.overallRating })
    })
    return result
  }, [entries])

  // ── consistency vs taste scatter ──────────────────────────────────────────
  const scatterData = useMemo(() => {
    const result: { entry: Entry; taste: number; consistency: number; overall: number | null }[] = []
    entries.forEach(e => {
      const sorted = sortReviewsByDateDesc(e.reviews)
      const taste = sorted.find(r => r.rating1 !== null)?.rating1 ?? null
      const consistency = sorted.find(r => r.rating3 !== null)?.rating3 ?? null
      if (taste === null || consistency === null) return
      const overall = sorted.find(r => r.overallRating !== null)?.overallRating ?? null
      result.push({ entry: e, taste, consistency, overall })
    })
    return result
  }, [entries])

  // ── underrated gems ───────────────────────────────────────────────────────
  const underratedGems = useMemo(() => {
    const result: { entry: Entry; rating: number }[] = []
    entries.forEach(e => {
      if (e.reviews.length !== 1) return
      const r = latestRating(e.reviews)
      if (r === null || r < 8.0) return
      result.push({ entry: e, rating: r })
    })
    return result.sort((a, b) => b.rating - a.rating)
  }, [entries])

  // ── rating by country ──────────────────────────────────────────────────────
  const countryData = useMemo(() => {
    const map = new Map<string | null, { entries: Entry[]; ratings: number[] }>()
    entries.forEach(e => {
      const key = e.flag
      const bucket = map.get(key) ?? { entries: [], ratings: [] }
      bucket.entries.push(e)
      const r = latestRating(e.reviews)
      if (r !== null) bucket.ratings.push(r)
      map.set(key, bucket)
    })
    return Array.from(map.entries()).map(([flag, bucket]) => {
      const avg = bucket.ratings.length
        ? bucket.ratings.reduce((a, c) => a + c, 0) / bucket.ratings.length
        : null
      const bestEntry = bucket.entries
        .map(e => ({ entry: e, rating: latestRating(e.reviews) }))
        .filter(x => x.rating !== null)
        .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))[0]?.entry ?? null
      const countryName = flag ? (COUNTRIES.find(c => c.code === flag)?.name ?? flag) : 'Home'
      return { flag, countryName, entryCount: bucket.entries.length, avg, bestEntry }
    })
  }, [entries])

  const sortedCountryData = useMemo(() => {
    return [...countryData].sort((a, b) => {
      let cmp = 0
      if (countrySortCol === 'country') cmp = a.countryName.localeCompare(b.countryName)
      else if (countrySortCol === 'entries') cmp = a.entryCount - b.entryCount
      else if (countrySortCol === 'avg') cmp = (a.avg ?? -1) - (b.avg ?? -1)
      else cmp = (a.bestEntry?.foodName ?? '').localeCompare(b.bestEntry?.foodName ?? '')
      return countrySortDir === 'asc' ? cmp : -cmp
    })
  }, [countryData, countrySortCol, countrySortDir])

  function handleCountrySort(col: 'country' | 'entries' | 'avg' | 'best') {
    if (countrySortCol === col) {
      setCountrySortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setCountrySortCol(col)
      setCountrySortDir(col === 'avg' ? 'desc' : 'asc')
    }
  }

  function CountrySortArrow({ col }: { col: 'country' | 'entries' | 'avg' | 'best' }) {
    if (countrySortCol !== col)
      return <span style={{ color: 'var(--ink-mute)', marginLeft: 4, fontSize: '0.65rem', opacity: 0.5 }}>↕</span>
    return <span style={{ color: 'var(--accent)', marginLeft: 4, fontSize: '0.65rem' }}>{countrySortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const goldRowBorder = { borderTop: '1px solid var(--line)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', borderLeft: '3px solid var(--gold)' }

  const pagedStarredPicks = starredPicks.slice(starredPage * STARRED_PAGE_SIZE, (starredPage + 1) * STARRED_PAGE_SIZE)
  const starredShowStart = starredPage * STARRED_PAGE_SIZE + 1
  const starredShowEnd = Math.min((starredPage + 1) * STARRED_PAGE_SIZE, starredPicks.length)
  const pagedGems = underratedGems.slice(gemsPage * GEMS_PAGE_SIZE, (gemsPage + 1) * GEMS_PAGE_SIZE)
  const gemsShowStart = gemsPage * GEMS_PAGE_SIZE + 1
  const gemsShowEnd = Math.min((gemsPage + 1) * GEMS_PAGE_SIZE, underratedGems.length)
  const pagedLtns = longTimeNoSee.slice(ltnsPage * LTNS_PAGE_SIZE, (ltnsPage + 1) * LTNS_PAGE_SIZE)
  const ltnsShowStart = ltnsPage * LTNS_PAGE_SIZE + 1
  const ltnsShowEnd = Math.min((ltnsPage + 1) * LTNS_PAGE_SIZE, longTimeNoSee.length)

  return (
    <div ref={rootRef} style={{ width: '100%' }}>
      <p style={kickerStyle}>By the numbers</p>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ ...pageTitleStyle, marginBottom: '0.35rem' }}>Analytics</h1>
        <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 13, color: 'var(--ink-mute)' }}>
          {totalEntries} foods logged. Here's what they say about you.
        </p>
      </div>

      {/* B + C. Rating distribution / Starred ratio */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <SectionErrorBoundary title="Rating Distribution">
          <Card style={{ minWidth: 0 }}>
            <SectionLabel>Rating Distribution</SectionLabel>
            <div ref={ratingDonutView.ref} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Donut
                segments={[
                  { color: COLOR_GOOD, pct: pct(distribution.good, distribution.total) },
                  { color: COLOR_MID, pct: pct(distribution.mid, distribution.total) },
                  { color: COLOR_BAD, pct: pct(distribution.bad, distribution.total) },
                ]}
                centerTop={avgRating != null ? animatedAvg.toFixed(2) : '—'}
                centerTopColor="var(--accent)"
                centerBottom="avg rating"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                <LegendRow color={COLOR_GOOD} label="Good (≥ 7)" pct={pct(distribution.good, distribution.total)} count={distribution.good} />
                <LegendRow color={COLOR_MID} label="Mid (4.5–7)" pct={pct(distribution.mid, distribution.total)} count={distribution.mid} />
                <LegendRow color={COLOR_BAD} label="Bad (< 4.5)" pct={pct(distribution.bad, distribution.total)} count={distribution.bad} />
              </div>
            </div>
          </Card>
        </SectionErrorBoundary>

        <SectionErrorBoundary title="Starred Ratio">
          <Card style={{ minWidth: 0 }}>
            <SectionLabel>Starred Ratio</SectionLabel>
            <div ref={starredDonutView.ref} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Donut
                segments={[
                  { color: 'var(--gold)', pct: pct(starredRatio.starred, starredRatio.total) },
                  { color: COLOR_MID, pct: pct(starredRatio.unstarred, starredRatio.total) },
                ]}
                centerTop={String(Math.round(animatedStarred))}
                centerTopColor="var(--gold)"
                centerBottom="starred"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                <LegendRow color="var(--gold)" label="Starred" pct={pct(starredRatio.starred, starredRatio.total)} count={starredRatio.starred} />
                <LegendRow color={COLOR_MID} label="Unstarred" pct={pct(starredRatio.unstarred, starredRatio.total)} count={starredRatio.unstarred} />
              </div>
            </div>
          </Card>
        </SectionErrorBoundary>
      </div>

      {/* D + E. Top categories / Best restaurants */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <SectionErrorBoundary title="Top Categories">
          <Card style={{ minWidth: 0 }}>
            <SectionLabel>Top Categories by Avg Rating</SectionLabel>
            <div ref={topCatsView.ref} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {topCategories.map((c, i) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 130, flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-mute)' }}>{c.count} entries</div>
                  </div>
                  <div style={{ flex: 1, height: 8, background: 'var(--paper)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: topCatsView.inView ? `${(c.avg / 10) * 100}%` : '0%',
                      height: '100%',
                      background: 'linear-gradient(to right, #e74c3c, #f39c12, #2ecc71)',
                      backgroundSize: c.avg > 0 ? `${1000 / c.avg}% 100%` : '100% 100%',
                      borderRadius: 4,
                      transition: 'width 500ms ease-out',
                      transitionDelay: `${i * 60}ms`,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: scoreColor(c.avg), width: 36, textAlign: 'right' as const, flexShrink: 0 }}>{c.avg.toFixed(1)}</span>
                </div>
              ))}
              {topCategories.length === 0 && <EmptyMsg>Not enough data</EmptyMsg>}
            </div>
          </Card>
        </SectionErrorBoundary>

        <SectionErrorBoundary title="Best Restaurants">
          <Card style={{ minWidth: 0 }}>
            <SectionLabel>Best Restaurants by Avg Rating</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {bestRestaurants.map((r, i) => (
                <RankRow key={r.name} rank={i + 1} name={r.name} visits={r.visits} avg={r.avg} onClick={() => navigate('/restaurants')} />
              ))}
              {bestRestaurants.length === 0 && <EmptyMsg>Not enough data</EmptyMsg>}
            </div>
          </Card>
        </SectionErrorBoundary>
      </div>

      {/* D2 + E2. Most visited stores / Most logged categories */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <SectionErrorBoundary title="Most Visited Stores">
          <Card style={{ minWidth: 0 }}>
            <p style={kickerStyle}>MOST VISITED STORES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {mostVisitedStores.map((r, i) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 16, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', flexShrink: 0 }}>{r.count}×</span>
                </div>
              ))}
              {mostVisitedStores.length === 0 && <EmptyMsg>No data yet</EmptyMsg>}
            </div>
          </Card>
        </SectionErrorBoundary>

        <SectionErrorBoundary title="Most Logged Categories">
          <Card style={{ minWidth: 0 }}>
            <p style={kickerStyle}>MOST LOGGED CATEGORIES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {mostLoggedCategories.map((c, i) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 16, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', flexShrink: 0 }}>{c.count}×</span>
                </div>
              ))}
              {mostLoggedCategories.length === 0 && <EmptyMsg>No data yet</EmptyMsg>}
            </div>
          </Card>
        </SectionErrorBoundary>
      </div>

      {/* F + L. Category Insights — Best Spot + Score Breakdown (shared pill row) */}
      <SectionErrorBoundary title="Category Insights">
        <Card style={{ marginBottom: '1.5rem' }}>
          <p style={kickerStyle}>CATEGORY INSIGHTS</p>
          {breakdownCategories.length > 0 ? (
            <>
              <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: 32, height: '100%',
                  background: 'linear-gradient(to right, var(--paper-2), transparent)',
                  pointerEvents: 'none', zIndex: 1,
                  opacity: catPillScroll.left ? 1 : 0,
                  transition: 'opacity 150ms',
                }} />
                <div style={{
                  position: 'absolute', top: 0, right: 0, width: 32, height: '100%',
                  background: 'linear-gradient(to left, var(--paper-2), transparent)',
                  pointerEvents: 'none', zIndex: 1,
                  opacity: catPillScroll.right ? 1 : 0,
                  transition: 'opacity 150ms',
                }} />
                <div
                  ref={pillScrollRef}
                  className="hide-scrollbar"
                  style={{ display: 'flex', overflowX: 'auto', flexWrap: 'nowrap', gap: '6px', padding: '2px 0' }}
                >
                  {breakdownCategories.map(c => (
                    <button
                      key={c.name}
                      ref={el => { if (el) pillRefsMap.current.set(c.name, el); else pillRefsMap.current.delete(c.name) }}
                      onClick={() => setActiveCategory(c.name)}
                      className="pill"
                      style={{ ...pillStyle(c.name === effectiveCategory), flexShrink: 0 }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', margin: '0 0 0.35rem' }}>Best Spot per Category</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', margin: '0 0 0.75rem' }}>
                Restaurant with highest avg rating · min 2 entries per restaurant
              </p>
              {bestSpotList.length >= 2 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1.25rem' }}>
                  {bestSpotList.map((r, i) => (
                    <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 16, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: scoreColor(r.avg), flexShrink: 0 }}>{r.avg.toFixed(1)}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 70, textAlign: 'right' as const, flexShrink: 0 }}>{r.count} entries</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginBottom: '1.25rem' }}><EmptyMsg>Not enough data for this category</EmptyMsg></div>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0 0 1.25rem' }} />
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', margin: '0 0 0.25rem' }}>Score Breakdown by Category</p>
              <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.8rem', color: 'var(--ink-mute)', margin: '0 0 1rem' }}>
                How it actually tastes, costs, and holds up.
              </p>
              {breakdownData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {([
                    { label: 'Taste', d: breakdownData.taste },
                    { label: 'Value', d: breakdownData.value },
                    { label: 'Consistency', d: breakdownData.consistency },
                  ] as const).map(({ label, d }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ width: 96, flexShrink: 0, fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.85rem', color: 'var(--ink-mute)' }}>
                        {label}
                      </span>
                      <div style={{ flex: 1, height: 12, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          borderRadius: 6,
                          width: d.avg !== null ? `${(d.avg / 10) * 100}%` : '0%',
                          background: 'linear-gradient(to right, #e74c3c, #f39c12, #2ecc71)',
                          backgroundSize: d.avg !== null && d.avg > 0 ? `${1000 / d.avg}% 100%` : '100% 100%',
                          transition: 'width 400ms ease, background-size 400ms ease',
                        }} />
                      </div>
                      <div style={{ width: 56, flexShrink: 0, textAlign: 'right' as const }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: d.avg !== null ? scoreColor(d.avg) : 'var(--ink-mute)', lineHeight: 1.2 }}>
                          {d.avg !== null ? d.avg.toFixed(2) : '—'}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-mute)', lineHeight: 1.2 }}>
                          {d.count > 0 ? `(${d.count})` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyMsg>Not enough data</EmptyMsg>
              )}
            </>
          ) : (
            <EmptyMsg>Not enough data</EmptyMsg>
          )}
        </Card>
      </SectionErrorBoundary>

      {/* G. Rating trajectory */}
      <SectionErrorBoundary title="Rating Trajectory">
        <Card style={{ marginBottom: '1.5rem' }}>
          <p style={kickerStyle}>MOMENTUM</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', margin: '0 0 0.25rem' }}>Rating Trajectory</p>
          <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.8rem', color: 'var(--ink-mute)', margin: '0 0 1rem' }}>
            Foods that have gotten better or worse over repeat visits.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className="pill" onClick={() => selectMoverFilter('improved')} style={pillStyle(moverFilter === 'improved')}>Most improved</button>
            <button className="pill" onClick={() => selectMoverFilter('declined')} style={pillStyle(moverFilter === 'declined')}>Most declined</button>
            <button className="pill" onClick={() => selectMoverFilter('all')} style={pillStyle(moverFilter === 'all')}>All movers</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {displayedMovers.map(m => (
              <div
                key={m.entry.id}
                onClick={() => navigate(`/entries/${m.entry.id}`, { state: { background: location } })}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--paper)', cursor: 'pointer' }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{m.entry.foodName}</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--ink-mute)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 110 }}>{m.entry.category}</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--ink-mute)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 130 }}>{m.entry.restaurant.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{m.first.toFixed(1)} → {m.latest.toFixed(1)}</span>
                <DeltaBadge delta={m.delta} />
              </div>
            ))}
            {displayedMovers.length === 0 && <EmptyMsg>Not enough data</EmptyMsg>}
          </div>
          {moverFilter === 'all' && !showAllMovers && movers.length > 20 && (
            <span
              onClick={() => setShowAllMovers(true)}
              style={{ display: 'inline-block', marginTop: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent)' }}
            >
              Show all {movers.length} entries
            </span>
          )}
        </Card>
      </SectionErrorBoundary>

      {/* I. Logging Activity */}
      <SectionErrorBoundary title="Logging Activity">
        <Card style={{ marginBottom: '1.5rem' }}>
          <p style={kickerStyle}>CONSISTENCY</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', margin: 0 }}>Logging Activity</p>
            {availableYears.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {availableYears.map(y => (
                  <button key={y} className="pill" onClick={() => setSelectedYearOverride(y)} style={pillStyle(y === selectedYear)}>{y}</button>
                ))}
              </div>
            )}
          </div>
          <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.8rem', color: 'var(--ink-mute)', margin: '0 0 1rem' }}>
            Every cell is a day you ate something worth logging.
          </p>
          {availableYears.length > 0 ? (
            <div>
              {/* Month labels — spacer matches day-labels column so percentages align with grid */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <div style={{ width: 28, flexShrink: 0 }} />
                <div style={{ flex: 1, position: 'relative', height: 18 }}>
                  {heatmapGrid.monthLabels.map(({ label, col }) => (
                    <span key={label} style={{
                      position: 'absolute',
                      left: `${(col / 53) * 100}%`,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: 'var(--ink-mute)',
                      userSelect: 'none',
                    }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              {/* Day labels + grid */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                {/* Day-of-week labels */}
                <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 11px)', gap: 2, width: 28, flexShrink: 0 }}>
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <span key={i} style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: 'var(--ink-mute)',
                      lineHeight: '11px',
                      textAlign: 'right' as const,
                      visibility: ([1, 3, 5].includes(i) ? 'visible' : 'hidden') as React.CSSProperties['visibility'],
                      userSelect: 'none' as const,
                    }}>
                      {i === 1 ? 'Mon' : i === 3 ? 'Wed' : i === 5 ? 'Fri' : ''}
                    </span>
                  ))}
                </div>
                {/* Heatmap grid — 1fr per week so it fills the card width */}
                <style>{`
                  @keyframes cellPulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                    100% { transform: scale(1); }
                  }
                `}</style>
                <div ref={heatmapView.ref} style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(53, 1fr)',
                  gridTemplateRows: 'repeat(7, 11px)',
                  gridAutoFlow: 'column',
                  gap: 2,
                }}>
                  {heatmapGrid.cells.map((cell, k) => (
                    cell.dateStr ? (
                      <div
                        key={k}
                        style={{
                          borderRadius: 2,
                          cursor: 'default',
                          boxSizing: 'border-box',
                          ...cellColor(cell.count),
                          ...(heatmapView.inView && cell.count > 0 ? {
                            animation: 'cellPulse 400ms ease-out',
                            animationDelay: `${Math.floor(k / 7) * 20}ms`,
                          } : {}),
                        }}
                        onMouseEnter={(e) => setHeatmapTooltip({ x: e.clientX, y: e.clientY, dateStr: cell.dateStr!, count: cell.count })}
                        onMouseLeave={() => setHeatmapTooltip(null)}
                        onMouseMove={(e) => setHeatmapTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      />
                    ) : (
                      <div key={k} />
                    )
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyMsg>No dated reviews yet</EmptyMsg>
          )}
        </Card>
      </SectionErrorBoundary>
      {heatmapTooltip && (
        <div style={{
          position: 'fixed',
          left: heatmapTooltip.x + 12,
          top: heatmapTooltip.y - 40,
          zIndex: 9999,
          pointerEvents: 'none',
          background: 'var(--paper-2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: '4px 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color: 'var(--ink)',
          whiteSpace: 'nowrap' as const,
        }}>
          {formatHeatmapDate(heatmapTooltip.dateStr)} · {heatmapTooltip.count === 0 ? 'No reviews' : `${heatmapTooltip.count} review${heatmapTooltip.count === 1 ? '' : 's'}`}
        </div>
      )}

      {/* N + O. Scatter charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
      {/* N. Consistency vs Taste scatter */}
      <SectionErrorBoundary title="Consistency vs Taste">
        <Card style={{ minWidth: 0 }}>
          <p style={kickerStyle}>SCATTER</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', margin: '0 0 0.25rem' }}>Consistency vs Taste</p>
          <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.8rem', color: 'var(--ink-mute)', margin: '0 0 1rem' }}>
            Each dot is one entry. Hover for details.
          </p>
          {scatterData.length < 3 ? (
            <EmptyMsg>Not enough data — need at least 3 entries with both Taste and Consistency ratings.</EmptyMsg>
          ) : (
            <div ref={scatterContainerRef} style={{ width: '100%', overflow: 'hidden' }}>
              {(() => {
                const ML = 50, MR = 16, MT = 20, MB = 44
                const PW = Math.max(scatterWidth - ML - MR, 10)
                const PH = 320 - MT - MB
                const sx = (v: number) => ML + (v / 10) * PW
                const sy = (v: number) => MT + (1 - v / 10) * PH
                const TICKS = [0, 2, 4, 6, 8, 10]
                return (
                  <svg width={scatterWidth} height={320} style={{ display: 'block', overflow: 'visible' }}>
                    {/* Gridlines */}
                    {TICKS.map(v => (
                      <g key={v}>
                        <line x1={sx(v)} y1={MT} x2={sx(v)} y2={MT + PH} stroke="var(--line)" strokeOpacity={0.4} strokeDasharray="4 3" />
                        <line x1={ML} y1={sy(v)} x2={ML + PW} y2={sy(v)} stroke="var(--line)" strokeOpacity={0.4} strokeDasharray="4 3" />
                      </g>
                    ))}
                    {/* Quadrant dividers */}
                    <line x1={sx(5)} y1={MT} x2={sx(5)} y2={MT + PH} stroke="var(--line)" strokeOpacity={0.6} />
                    <line x1={ML} y1={sy(5)} x2={ML + PW} y2={sy(5)} stroke="var(--line)" strokeOpacity={0.6} />
                    {/* Quadrant labels */}
                    {([
                      { label: 'Reliable & Tasty',       x: ML + PW - 6,  y: MT + 13,       anchor: 'end' },
                      { label: 'Tasty but Inconsistent', x: ML + 6,        y: MT + 13,       anchor: 'start' },
                      { label: 'Consistent but Bland',   x: ML + PW - 6,  y: MT + PH - 6,   anchor: 'end' },
                      { label: 'Avoid',                  x: ML + 6,        y: MT + PH - 6,   anchor: 'start' },
                    ] as const).map(q => (
                      <text key={q.label} x={q.x} y={q.y} textAnchor={q.anchor} fill="var(--ink-mute)" fontSize={10} fontFamily="var(--font-mono)" opacity={0.6}>{q.label}</text>
                    ))}
                    {/* Plot border */}
                    <rect x={ML} y={MT} width={PW} height={PH} fill="none" stroke="var(--line)" strokeOpacity={0.5} />
                    {/* X-axis ticks + labels */}
                    {TICKS.map(v => (
                      <text key={v} x={sx(v)} y={MT + PH + 16} textAnchor="middle" fill="var(--ink-mute)" fontSize={10} fontFamily="var(--font-mono)">{v}</text>
                    ))}
                    {/* Y-axis ticks + labels */}
                    {TICKS.map(v => (
                      <text key={v} x={ML - 7} y={sy(v)} textAnchor="end" dominantBaseline="middle" fill="var(--ink-mute)" fontSize={10} fontFamily="var(--font-mono)">{v}</text>
                    ))}
                    {/* Axis labels */}
                    <text x={ML + PW / 2} y={320 - 6} textAnchor="middle" fill="var(--ink-mute)" fontSize={11} fontFamily="var(--font-mono)">Consistency →</text>
                    <text transform="rotate(-90)" x={-(MT + PH / 2)} y={14} textAnchor="middle" fill="var(--ink-mute)" fontSize={11} fontFamily="var(--font-mono)">Taste ↑</text>
                    {/* Dots */}
                    {scatterData.map(({ entry, taste, consistency }) => {
                      const isHovered = hoveredDotId === entry.id
                      return (
                        <circle
                          key={entry.id}
                          cx={sx(consistency)}
                          cy={sy(taste)}
                          r={isHovered ? 7 : 5}
                          fill={entry.starred ? 'var(--gold)' : 'var(--accent)'}
                          opacity={isHovered ? 1 : 0.7}
                          style={{ cursor: 'pointer', transition: 'r 100ms, opacity 100ms' }}
                          onMouseEnter={e => {
                            setHoveredDotId(entry.id)
                            setScatterTooltip({ x: e.clientX, y: e.clientY, foodName: entry.foodName, restaurant: entry.restaurant.name, category: entry.category, taste, consistency, overall: scatterData.find(d => d.entry.id === entry.id)?.overall ?? null })
                          }}
                          onMouseLeave={() => { setHoveredDotId(null); setScatterTooltip(null) }}
                          onMouseMove={e => setScatterTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                          onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
                        />
                      )
                    })}
                  </svg>
                )
              })()}
            </div>
          )}
        </Card>
      </SectionErrorBoundary>
      {/* O. Price vs Rating scatter */}
      <SectionErrorBoundary title="Price vs Rating">
        <Card style={{ minWidth: 0 }}>
          <p style={kickerStyle}>VALUE</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', margin: '0 0 0.25rem' }}>Price vs Rating</p>
          <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.8rem', color: 'var(--ink-mute)', margin: '0 0 1rem' }}>
            Does spending more mean rating higher?
          </p>
          {priceScatterData.length < 3 ? (
            <EmptyMsg>Not enough price data yet — add prices to your reviews to unlock this chart.</EmptyMsg>
          ) : (
            <div ref={priceContainerRef} style={{ width: '100%', overflow: 'hidden' }}>
              {(() => {
                const ML = 50, MR = 16, MT = 20, MB = 44
                const PW = Math.max(priceWidth - ML - MR, 10)
                const PH = 320 - MT - MB
                const maxP = Math.max(...priceScatterData.map(d => d.price))
                const maxPR = Math.ceil(maxP / 50) * 50 || 50
                const xTicks = [0, 1, 2, 3, 4].map(i => Math.round((i / 4) * maxPR))
                const yTicks = [0, 2, 4, 6, 8, 10]
                const sx = (v: number) => ML + (v / maxPR) * PW
                const sy = (v: number) => MT + (1 - v / 10) * PH
                return (
                  <svg width={priceWidth} height={320} style={{ display: 'block', overflow: 'visible' }}>
                    {xTicks.map(v => (
                      <line key={`xg${v}`} x1={sx(v)} y1={MT} x2={sx(v)} y2={MT + PH} stroke="var(--line)" strokeOpacity={0.4} strokeDasharray="4 3" />
                    ))}
                    {yTicks.map(v => (
                      <line key={`yg${v}`} x1={ML} y1={sy(v)} x2={ML + PW} y2={sy(v)} stroke="var(--line)" strokeOpacity={0.4} strokeDasharray="4 3" />
                    ))}
                    <rect x={ML} y={MT} width={PW} height={PH} fill="none" stroke="var(--line)" strokeOpacity={0.5} />
                    {xTicks.map(v => (
                      <text key={`xt${v}`} x={sx(v)} y={MT + PH + 16} textAnchor="middle" fill="var(--ink-mute)" fontSize={10} fontFamily="var(--font-mono)">
                        {v >= 1000 ? `${v / 1000}k` : v}
                      </text>
                    ))}
                    {yTicks.map(v => (
                      <text key={`yt${v}`} x={ML - 7} y={sy(v)} textAnchor="end" dominantBaseline="middle" fill="var(--ink-mute)" fontSize={10} fontFamily="var(--font-mono)">{v}</text>
                    ))}
                    <text x={ML + PW / 2} y={320 - 6} textAnchor="middle" fill="var(--ink-mute)" fontSize={11} fontFamily="var(--font-mono)">Price (₱) →</text>
                    <text transform="rotate(-90)" x={-(MT + PH / 2)} y={14} textAnchor="middle" fill="var(--ink-mute)" fontSize={11} fontFamily="var(--font-mono)">Rating ↑</text>
                    {priceScatterData.map(({ entry, price, overall }) => {
                      const isHovered = hoveredPriceDotId === entry.id
                      return (
                        <circle
                          key={entry.id}
                          cx={sx(price)}
                          cy={sy(overall)}
                          r={isHovered ? 7 : 5}
                          fill={entry.starred ? 'var(--gold)' : 'var(--accent)'}
                          opacity={isHovered ? 1 : 0.7}
                          style={{ cursor: 'pointer', transition: 'r 100ms, opacity 100ms' }}
                          onMouseEnter={e => {
                            setHoveredPriceDotId(entry.id)
                            setPriceTooltip({ x: e.clientX, y: e.clientY, foodName: entry.foodName, restaurant: entry.restaurant.name, category: entry.category, price, overall })
                          }}
                          onMouseLeave={() => { setHoveredPriceDotId(null); setPriceTooltip(null) }}
                          onMouseMove={e => setPriceTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                          onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
                        />
                      )
                    })}
                  </svg>
                )
              })()}
            </div>
          )}
        </Card>
      </SectionErrorBoundary>
      </div>
      {scatterTooltip && (
        <div style={{
          position: 'fixed',
          left: scatterTooltip.x + 14,
          top: scatterTooltip.y - 50,
          zIndex: 9999,
          pointerEvents: 'none',
          background: 'var(--paper-2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '7px 10px',
          fontFamily: 'Hanken Grotesk, sans-serif',
          fontSize: '0.78rem',
          color: 'var(--ink)',
          whiteSpace: 'nowrap' as const,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}>
          <span style={{ fontWeight: 700 }}>{scatterTooltip.foodName}</span>
          <span style={{ color: 'var(--ink-mute)' }}>{scatterTooltip.restaurant}</span>
          <span style={{ color: 'var(--ink-mute)' }}>{scatterTooltip.category}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem' }}>
            T: {scatterTooltip.taste.toFixed(2)} / C: {scatterTooltip.consistency.toFixed(2)}
          </span>
          {scatterTooltip.overall !== null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: scoreColor(scatterTooltip.overall) }}>
              {scatterTooltip.overall.toFixed(2)}
            </span>
          )}
        </div>
      )}
      {priceTooltip && (
        <div style={{
          position: 'fixed',
          left: priceTooltip.x + 14,
          top: priceTooltip.y - 50,
          zIndex: 9999,
          pointerEvents: 'none',
          background: 'var(--paper-2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '7px 10px',
          fontFamily: 'Hanken Grotesk, sans-serif',
          fontSize: '0.78rem',
          color: 'var(--ink)',
          whiteSpace: 'nowrap' as const,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}>
          <span style={{ fontWeight: 700 }}>{priceTooltip.foodName}</span>
          <span style={{ color: 'var(--ink-mute)' }}>{priceTooltip.restaurant}</span>
          <span style={{ color: 'var(--ink-mute)' }}>{priceTooltip.category}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem' }}>₱{priceTooltip.price}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: scoreColor(priceTooltip.overall) }}>
            {priceTooltip.overall.toFixed(2)}
          </span>
        </div>
      )}

      {/* M. Long Time No See */}
      <SectionErrorBoundary title="Long Time No See">
        <Card style={{ marginBottom: '1.5rem' }}>
          <p style={kickerStyle}>OVERDUE</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', margin: '0 0 0.25rem' }}>Long Time No See</p>
          <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.8rem', color: 'var(--ink-mute)', margin: '0 0 1.25rem' }}>
            One visit. Never went back. You had one job.
          </p>
          {longTimeNoSee.length > 0 ? (
            <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)' }}>
                  <th style={{ ...countryThStyle, width: 44, textAlign: 'center' }}>#</th>
                  <th style={{ ...countryThStyle, textAlign: 'left' }}>Entry</th>
                  <th style={{ ...countryThStyle, textAlign: 'left' }}>Category</th>
                  <th style={{ ...countryThStyle, textAlign: 'left' }}>Restaurant</th>
                  <th style={{ ...countryThStyle, textAlign: 'right', width: 130 }}>Visited</th>
                  <th style={{ ...countryThStyle, textAlign: 'right', width: 80 }}>Days Ago</th>
                </tr>
              </thead>
              <tbody>
                {pagedLtns.map(({ entry, dateStr, daysAgo }, i) => {
                  const daysColor = daysAgo > 365
                    ? 'var(--badge-never-again)'
                    : daysAgo >= 180
                      ? 'var(--gold)'
                      : 'var(--ink-mute)'
                  return (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: '1px solid var(--line)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--paper-2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                    >
                      <td style={{ ...countryTdStyle, textAlign: 'center', color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{ltnsPage * LTNS_PAGE_SIZE + i + 1}</td>
                      <td style={countryTdStyle}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                          onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
                        >
                          {entry.flag && <FlagImage code={entry.flag} />}
                          <span style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '0.88rem' }}>{entry.foodName}</span>
                        </div>
                      </td>
                      <td style={{ ...countryTdStyle, color: 'var(--ink-mute)', fontSize: '0.82rem' }}>{entry.category}</td>
                      <td style={{ ...countryTdStyle, color: 'var(--ink-mute)', fontSize: '0.82rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{entry.restaurant.name}</td>
                      <td style={{ ...countryTdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-mute)' }}>{formatReviewDate(dateStr)}</td>
                      <td style={{ ...countryTdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: daysColor }}>{daysAgo}d</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {longTimeNoSee.length > LTNS_PAGE_SIZE && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink-mute)' }}>
                  Showing {ltnsShowStart}–{ltnsShowEnd} of {longTimeNoSee.length}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setLtnsPage(p => p - 1)} disabled={ltnsPage === 0} style={smallSecondaryBtnStyle}>Prev</button>
                  <button onClick={() => setLtnsPage(p => p + 1)} disabled={ltnsShowEnd >= longTimeNoSee.length} style={smallSecondaryBtnStyle}>Next</button>
                </div>
              </div>
            )}
            </>
          ) : (
            <EmptyMsg>Nothing here — either you revisit everything or you haven't started logging dates yet.</EmptyMsg>
          )}
        </Card>
      </SectionErrorBoundary>

      {/* J. Rating by Country */}
      <SectionErrorBoundary title="Rating by Country">
        <Card style={{ marginBottom: '1.5rem' }}>
          <p style={kickerStyle}>ABROAD</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', margin: '0 0 0.25rem' }}>Rating by Country</p>
          <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.8rem', color: 'var(--ink-mute)', margin: '0 0 1.25rem' }}>
            How your ratings compare across countries — local entries grouped as Home 🏠
          </p>
          {sortedCountryData.length > 0 ? (
            <table ref={countryView.ref} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)' }}>
                  <th style={{ ...countryThStyle, width: 44, textAlign: 'center' }}>#</th>
                  <th style={{ ...countryThStyle, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleCountrySort('country')}>
                    Country <CountrySortArrow col="country" />
                  </th>
                  <th style={{ ...countryThStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: 90 }} onClick={() => handleCountrySort('entries')}>
                    Entries <CountrySortArrow col="entries" />
                  </th>
                  <th style={{ ...countryThStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: 210 }} onClick={() => handleCountrySort('avg')}>
                    Avg Rating <CountrySortArrow col="avg" />
                  </th>
                  <th style={{ ...countryThStyle, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleCountrySort('best')}>
                    Best Entry <CountrySortArrow col="best" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCountryData.map((row, i) => (
                  <tr
                    key={row.flag ?? '__home__'}
                    style={{ borderBottom: '1px solid var(--line)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--paper-2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                  >
                    <td style={{ ...countryTdStyle, textAlign: 'center', color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{i + 1}</td>
                    <td style={countryTdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {row.flag && <FlagImage code={row.flag} />}
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}>
                          {row.flag ? row.countryName : '🏠 Home'}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...countryTdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', fontSize: '0.82rem' }}>
                      {row.entryCount}
                    </td>
                    <td style={{ ...countryTdStyle, textAlign: 'right' }}>
                      {row.avg !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <div style={{ width: 80, height: 5, borderRadius: 3, background: 'var(--line)', flexShrink: 0, overflow: 'hidden' }}>
                            <div style={{
                              width: countryView.inView ? `${(row.avg / 10) * 100}%` : '0%',
                              height: '100%',
                              borderRadius: 3,
                              background: 'linear-gradient(to right, #e74c3c, #f39c12, #2ecc71)',
                              backgroundSize: row.avg > 0 ? `${1000 / row.avg}% 100%` : '100% 100%',
                              transition: 'width 500ms ease-out',
                              transitionDelay: `${i * 60}ms`,
                            }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.88rem', color: scoreColor(row.avg), minWidth: 38, textAlign: 'right' as const }}>
                            {row.avg.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-mute)' }}>—</span>
                      )}
                    </td>
                    <td style={countryTdStyle}>
                      {row.bestEntry ? (
                        <span
                          onClick={e => { e.stopPropagation(); navigate(`/entries/${row.bestEntry!.id}`, { state: { background: location } }) }}
                          style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500 }}
                        >
                          {row.bestEntry.foodName}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-mute)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyMsg>No entries yet</EmptyMsg>
          )}
        </Card>
      </SectionErrorBoundary>

      {/* K. Underrated Gems */}
      <SectionErrorBoundary title="Underrated Gems">
        <Card style={{ marginBottom: '1.5rem' }}>
          <p style={kickerStyle}>HIDDEN</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', margin: '0 0 0.25rem' }}>Underrated Gems</p>
          <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.8rem', color: 'var(--ink-mute)', margin: '0 0 1.25rem' }}>
            High scores, one visit. You're sleeping on these.
          </p>
          <style>{`
            .analytics-gems-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.75rem;
              width: 100%;
              min-width: 0;
              box-sizing: border-box;
            }
            .analytics-gems-grid > * { min-width: 0; box-sizing: border-box; }
            @media (max-width: 1023px) {
              .analytics-gems-grid { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 639px) {
              .analytics-gems-grid { grid-template-columns: 1fr; }
            }
            .gem-card {
              background: var(--surface);
              border: 1px solid var(--line);
              border-radius: 10px;
              padding: 1rem;
              cursor: pointer;
              display: flex;
              flex-direction: column;
              gap: 0.35rem;
              transition: border-color 150ms;
            }
            .gem-card:hover { border-color: var(--accent); }
            @keyframes gemIn {
              from { opacity: 0; transform: translateY(16px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {underratedGems.length > 0 ? (
            <>
            <div ref={gemsView.ref} className="analytics-gems-grid">
              {pagedGems.map(({ entry, rating }, i) => (
                <div
                  key={entry.id}
                  className="gem-card"
                  style={gemsView.inView ? { animation: 'gemIn 400ms ease-out both', animationDelay: `${i * 80}ms` } : undefined}
                  onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      {entry.flag && <FlagImage code={entry.flag} />}
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {entry.foodName}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginBottom: '0.4rem' }}>
                      {entry.restaurant.name}
                    </div>
                    <span style={{
                      display: 'inline-block',
                      background: 'var(--accent-wash)',
                      color: 'var(--accent-ink)',
                      borderRadius: 12,
                      padding: '0.15rem 0.55rem',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                    }}>
                      {entry.category}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-mute)' }}>1 visit</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-mute)', opacity: 0.6 }}>↗ revisit?</span>
                      {entry.tryAgain && <EntryFlagBadges tryAgain={true} neverAgain={false} uncertainRating={false} />}
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '2rem', color: 'var(--accent)', lineHeight: 1 }}>
                      {rating.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {underratedGems.length > GEMS_PAGE_SIZE && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink-mute)' }}>
                  Showing {gemsShowStart}–{gemsShowEnd} of {underratedGems.length}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setGemsPage(p => p - 1)} disabled={gemsPage === 0} style={smallSecondaryBtnStyle}>Prev</button>
                  <button onClick={() => setGemsPage(p => p + 1)} disabled={gemsShowEnd >= underratedGems.length} style={smallSecondaryBtnStyle}>Next</button>
                </div>
              </div>
            )}
            </>
          ) : (
            <EmptyMsg>No gems yet — revisit your favourites to move them out of here.</EmptyMsg>
          )}
        </Card>
      </SectionErrorBoundary>

      {/* H. Starred picks */}
      <SectionErrorBoundary title="Starred Picks">
        <Card>
          <SectionLabel>Starred Picks</SectionLabel>
          <style>{`
            .analytics-chip-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.75rem;
              width: 100%;
              min-width: 0;
              box-sizing: border-box;
            }
            .analytics-chip-grid > * { min-width: 0; box-sizing: border-box; }
            @media (max-width: 1100px) {
              .analytics-chip-grid { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 580px) {
              .analytics-chip-grid { grid-template-columns: 1fr; }
            }
          `}</style>
          <div className="analytics-chip-grid">
            {pagedStarredPicks.map(({ entry, rating }) => (
              <div
                key={entry.id}
                onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })}
                style={{
                  background: 'var(--gold-wash)',
                  ...goldRowBorder,
                  borderRadius: 10,
                  padding: '0.75rem 0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{entry.foodName}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{entry.restaurant.name} · {entry.category}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: rating != null ? scoreColor(rating) : 'var(--ink-mute)' }}>{rating != null ? rating.toFixed(2) : 'Unrated'}</span>
              </div>
            ))}
            {starredPicks.length === 0 && <EmptyMsg>No starred entries yet</EmptyMsg>}
          </div>
          {starredPicks.length > STARRED_PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink-mute)' }}>
                Showing {starredShowStart}–{starredShowEnd} of {starredPicks.length}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStarredPage(p => p - 1)} disabled={starredPage === 0} style={smallSecondaryBtnStyle}>Prev</button>
                <button onClick={() => setStarredPage(p => p + 1)} disabled={starredShowEnd >= starredPicks.length} style={smallSecondaryBtnStyle}>Next</button>
              </div>
            </div>
          )}
        </Card>
      </SectionErrorBoundary>

    </div>
  )
}

const countryThStyle: React.CSSProperties = {
  padding: '0.55rem 0.875rem',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const countryTdStyle: React.CSSProperties = {
  padding: '0.7rem 0.875rem',
  verticalAlign: 'middle',
}
