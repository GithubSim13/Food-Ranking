import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { getEntries } from '../../api/entries'
import SectionErrorBoundary from '../common/SectionErrorBoundary'
import { Card, SectionLabel, RankRow } from '../home/HomeShared'
import { pillStyle } from '../common/SearchAndScopeBar'
import { kickerStyle, pageTitleStyle } from '../common/pageStyles'
import { latestRating, sortReviewsByDateDesc, scoreColor } from '../../utils'
import type { Entry } from '../../types'

const COLOR_GOOD = 'var(--accent)'
const COLOR_MID = 'var(--ink-mute)'
const COLOR_BAD = '#c0392b'

function pct(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0
}

function StatCard({ value, label, subtitle, color }: { value: string; label: string; subtitle?: string; color?: string }) {
  return (
    <Card>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.7rem', fontWeight: 700, color: color ?? 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>{label}</div>
      {subtitle && <div style={{ marginTop: '0.2rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-mute)' }}>{subtitle}</div>}
    </Card>
  )
}

function Donut({ segments, size = 110 }: { segments: { color: string; pct: number }[]; size?: number }) {
  let acc = 0
  const stops: string[] = []
  segments.forEach(s => {
    if (s.pct <= 0) return
    const start = acc
    acc += s.pct
    stops.push(`${s.color} ${start}% ${acc}%`)
  })
  const gradient = stops.length ? `conic-gradient(${stops.join(', ')})` : 'var(--line)'
  const hole = size * 0.6
  const inset = (size - hole) / 2
  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: gradient, flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: inset, left: inset, width: hole, height: hole, borderRadius: '50%', background: 'var(--surface)' }} />
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

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: entries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [moverFilter, setMoverFilter] = useState<MoverFilter>('improved')
  const [showAllMovers, setShowAllMovers] = useState(false)

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
  const goodCount = ratedList.filter(x => x.rating >= 7).length
  const goodPct = ratedList.length ? Math.round(pct(goodCount, ratedList.length)) : 0
  const tryAgainCount = entries.filter(e => e.tryAgain).length

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

  const qualifyingCategories = useMemo(() => {
    const cats: string[] = []
    catRestMap.forEach((restMap, category) => {
      if (Array.from(restMap.values()).some(b => b.ratings.length >= 2)) cats.push(category)
    })
    return cats.sort((a, b) => a.localeCompare(b))
  }, [catRestMap])

  const effectiveCategory = activeCategory && qualifyingCategories.includes(activeCategory)
    ? activeCategory
    : qualifyingCategories[0] ?? null

  const bestSpotList = useMemo(() => {
    if (!effectiveCategory) return []
    const restMap = catRestMap.get(effectiveCategory)
    if (!restMap) return []
    return Array.from(restMap.values())
      .filter(b => b.ratings.length >= 2)
      .map(b => ({ name: b.name, count: b.ratings.length, avg: b.ratings.reduce((a, c) => a + c, 0) / b.ratings.length }))
      .sort((a, b) => b.avg - a.avg)
  }, [catRestMap, effectiveCategory])

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

  const goldRowBorder = { borderTop: '1px solid var(--line)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', borderLeft: '3px solid var(--gold)' }

  return (
    <div style={{ width: '100%' }}>
      <p style={kickerStyle}>By the numbers</p>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ ...pageTitleStyle, marginBottom: '0.35rem' }}>Analytics</h1>
        <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 13, color: 'var(--ink-mute)' }}>
          Patterns and stats across {totalEntries} entries
        </p>
      </div>

      {/* A. Overview stat row */}
      <SectionErrorBoundary title="Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard value={avgRating != null ? avgRating.toFixed(2) : '—'} label="Avg Rating" color="#6c47d4" />
          <StatCard value={`${starredCount} starred`} label="Starred" subtitle={`${starredCount} of ${totalEntries} entries`} color="var(--gold)" />
          <StatCard value={`${goodCount} · ${goodPct}%`} label="Good (≥ 7)" />
          <StatCard value={`${tryAgainCount}`} label="Try Again" />
        </div>
      </SectionErrorBoundary>

      {/* B + C. Rating distribution / Starred ratio */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <SectionErrorBoundary title="Rating Distribution">
          <Card>
            <SectionLabel>Rating Distribution</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Donut segments={[
                { color: COLOR_GOOD, pct: pct(distribution.good, distribution.total) },
                { color: COLOR_MID, pct: pct(distribution.mid, distribution.total) },
                { color: COLOR_BAD, pct: pct(distribution.bad, distribution.total) },
              ]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                <LegendRow color={COLOR_GOOD} label="Good (≥ 7)" pct={pct(distribution.good, distribution.total)} count={distribution.good} />
                <LegendRow color={COLOR_MID} label="Mid (4.5–7)" pct={pct(distribution.mid, distribution.total)} count={distribution.mid} />
                <LegendRow color={COLOR_BAD} label="Bad (< 4.5)" pct={pct(distribution.bad, distribution.total)} count={distribution.bad} />
              </div>
            </div>
          </Card>
        </SectionErrorBoundary>

        <SectionErrorBoundary title="Starred Ratio">
          <Card>
            <SectionLabel>Starred Ratio</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Donut segments={[
                { color: 'var(--gold)', pct: pct(starredRatio.starred, starredRatio.total) },
                { color: COLOR_MID, pct: pct(starredRatio.unstarred, starredRatio.total) },
              ]} />
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
          <Card>
            <SectionLabel>Top Categories by Avg Rating</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {topCategories.map(c => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 130, flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-mute)' }}>{c.count} entries</div>
                  </div>
                  <div style={{ flex: 1, height: 8, background: 'var(--paper)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(c.avg / 10) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: scoreColor(c.avg), width: 36, textAlign: 'right' as const, flexShrink: 0 }}>{c.avg.toFixed(1)}</span>
                </div>
              ))}
              {topCategories.length === 0 && <EmptyMsg>Not enough data</EmptyMsg>}
            </div>
          </Card>
        </SectionErrorBoundary>

        <SectionErrorBoundary title="Best Restaurants">
          <Card>
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

      {/* F. Best spot per category */}
      <SectionErrorBoundary title="Best Spot per Category">
        <Card style={{ marginBottom: '1.5rem' }}>
          <SectionLabel>Best Spot per Category</SectionLabel>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Restaurant with highest avg rating · min 2 entries per category
          </p>
          {qualifyingCategories.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {qualifyingCategories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} style={pillStyle(cat === effectiveCategory)}>{cat}</button>
                ))}
              </div>
              {bestSpotList.length >= 2 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
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
          <SectionLabel>Rating Trajectory</SectionLabel>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Entries with 2+ reviews — first rating vs latest
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button onClick={() => selectMoverFilter('improved')} style={pillStyle(moverFilter === 'improved')}>Most improved</button>
            <button onClick={() => selectMoverFilter('declined')} style={pillStyle(moverFilter === 'declined')}>Most declined</button>
            <button onClick={() => selectMoverFilter('all')} style={pillStyle(moverFilter === 'all')}>All movers</button>
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
            {starredPicks.map(({ entry, rating }) => (
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
        </Card>
      </SectionErrorBoundary>

    </div>
  )
}
