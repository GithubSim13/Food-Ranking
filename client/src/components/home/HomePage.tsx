import { useNavigate, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'
import { sortReviewsByDateDesc, latestRating, latestRatedReview, scoreColor, formatReviewDate } from '../../utils'
import SectionErrorBoundary from '../common/SectionErrorBoundary'
import { Card, SectionLabel, RankRow, firstNoteLine, type Top5Entry } from './HomeShared'
import PodiumSection from './PodiumSection'
import ReigningChampionCard from './ReigningChampionCard'
import LoggingPaceCard from './LoggingPaceCard'
import BestValueCard from './BestValueCard'

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: entries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  const hour = new Date().getHours()
  const greetingWord = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'

  // ── basic stats ────────────────────────────────────────────────────────────
  const totalFoods = entries.length
  const totalCategories = new Set(entries.map(e => e.category)).size
  const starredCount = entries.filter(e => e.starred).length
  const distinctRestCount = new Set(entries.map(e => e.restaurantId)).size
  const ratedEntryLatest = entries.map(e => latestRating(e.reviews)).filter((v): v is number => v !== null)
  const avgRating = ratedEntryLatest.length ? ratedEntryLatest.reduce((a, b) => a + b, 0) / ratedEntryLatest.length : null

  // ── top 5 ──────────────────────────────────────────────────────────────────
  const top5: Top5Entry[] = [...entries]
    .map(e => {
      const score = latestRating(e.reviews)
      const quote = sortReviewsByDateDesc(e.reviews)[0]?.notes?.split('\n')[0]?.trim() ?? ''
      return { id: e.id, name: e.foodName, flag: e.flag, score, starred: e.starred, category: e.category, restaurant: e.restaurant.name, reviewCount: e.reviews.length, quote }
    })
    .filter((e): e is Top5Entry => e.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  // ── hall of shame ──────────────────────────────────────────────────────────
  const shameList: Top5Entry[] = [...entries]
    .map(e => {
      const score = latestRating(e.reviews)
      const quote = sortReviewsByDateDesc(e.reviews)[0]?.notes?.split('\n')[0]?.trim() ?? ''
      return { id: e.id, name: e.foodName, flag: e.flag, score, starred: e.starred, category: e.category, restaurant: e.restaurant.name, reviewCount: e.reviews.length, quote }
    })
    .filter((e): e is Top5Entry => e.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)

  // ── champion (most-reviewed entry, tiebreak by overallRating desc) ─────────
  const champData = [...entries]
    .filter(e => e.starred && e.reviews.length > 0)
    .map(e => ({ entry: e, reviewCount: e.reviews.length, avg: latestRating(e.reviews) }))
    .sort((a, b) => b.reviewCount - a.reviewCount || (b.avg ?? 0) - (a.avg ?? 0))[0] ?? null
  const champEntry = champData?.entry ?? null
  const champScore = champData?.avg ?? null
  const champReviewCount = champData?.reviewCount ?? 0
  const champLatestReview = champEntry ? latestRatedReview(champEntry.reviews) : null
  const champTaste = champLatestReview?.rating1 ?? null
  const champValue = champLatestReview?.rating2 ?? null
  const champConsistency = champLatestReview?.rating3 ?? null
  const champNote = champEntry
    ? firstNoteLine(champEntry.reviews.find(r => r.notes && r.notes.trim() !== '')?.notes)
    : ''

  // ── fresh off the fork ─────────────────────────────────────────────────────
  const freshEntries = [...entries]
    .map(e => {
      const dates = e.reviews.map(r => r.date).filter((d): d is string => d !== null)
      const earliest = dates.sort()[0] ?? null
      return { id: e.id, name: e.foodName, flag: e.flag, reviewDate: earliest }
    })
    .filter(e => e.reviewDate !== null)
    .sort((a, b) => new Date(b.reviewDate!).getTime() - new Date(a.reviewDate!).getTime())
    .slice(0, 5)

  // ── restaurant aggregations ────────────────────────────────────────────────
  type RestBucket = {
    name: string
    total: number
    ratedAvgs: number[]
    valueScores: number[]
    valueItems: { name: string; valueScore: number }[]
  }
  const { topTables, regulars, bestValueRest, bestValueItems } = useMemo(() => {
    const restMap = new Map<number, RestBucket>()
    entries.forEach(e => {
      if (!restMap.has(e.restaurantId))
        restMap.set(e.restaurantId, { name: e.restaurant.name, total: 0, ratedAvgs: [], valueScores: [], valueItems: [] })
      const bucket = restMap.get(e.restaurantId)!
      bucket.total++
      const avg = latestRating(e.reviews)
      if (avg !== null) bucket.ratedAvgs.push(avg)
      const val = sortReviewsByDateDesc(e.reviews).find(r => r.rating2 !== null)?.rating2 ?? null
      if (val !== null) { bucket.valueScores.push(val); bucket.valueItems.push({ name: e.foodName, valueScore: val }) }
    })
    const topTables = Array.from(restMap.values())
      .filter(r => r.ratedAvgs.length >= 2)
      .map(r => ({ name: r.name, visits: r.total, avg: r.ratedAvgs.reduce((a, b) => a + b, 0) / r.ratedAvgs.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
    const regulars = Array.from(restMap.values())
      .map(r => ({
        name: r.name,
        visits: r.total,
        avg: r.ratedAvgs.length ? r.ratedAvgs.reduce((a, b) => a + b, 0) / r.ratedAvgs.length : null,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5)
    const bvRest = Array.from(restMap.values())
      .filter(r => r.valueScores.length >= 2)
      .map(r => ({ ...r, avgValue: r.valueScores.reduce((a, b) => a + b, 0) / r.valueScores.length }))
      .sort((a, b) => b.avgValue - a.avgValue)[0] ?? null
    const bestValueItems = bvRest
      ? [...bvRest.valueItems].sort((a, b) => b.valueScore - a.valueScore).slice(0, 5)
      : []
    return { topTables, regulars, bestValueRest: bvRest, bestValueItems }
  }, [entries])

  // ── logging pace ───────────────────────────────────────────────────────────
  const monthCountMap = new Map<string, number>()
  entries.forEach(e => {
    const dates = e.reviews.map(r => r.date).filter((d): d is string => d !== null)
    if (!dates.length) return
    const earliest = dates.sort()[0]
    const d = new Date(earliest)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    monthCountMap.set(key, (monthCountMap.get(key) ?? 0) + 1)
  })
  const sortedMonthKeys = Array.from(monthCountMap.keys()).sort()
  const chartData = sortedMonthKeys.map(key => {
    const [year, month] = key.split('-').map(Number)
    return {
      key,
      label: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' }).slice(0, 1),
      count: monthCountMap.get(key)!,
    }
  })
  const chartMax = chartData.length ? Math.max(...chartData.map(m => m.count)) : 1
  const chartPeakIdx = chartData.length
    ? chartData.reduce((best, m, i) => m.count > chartData[best].count ? i : best, 0)
    : 0
  const avgPerMonth = chartData.length
    ? chartData.reduce((sum, m) => sum + m.count, 0) / chartData.length
    : 0

  let peakMonthLabel = ''
  let peakMonthCount = 0
  if (chartData.length) {
    const [py, pm] = chartData[chartPeakIdx].key.split('-').map(Number)
    peakMonthLabel = `${new Date(py, pm - 1).toLocaleDateString('en-US', { month: 'short' })} '${String(py).slice(2)}`
    peakMonthCount = chartData[chartPeakIdx].count
  }

  let loggingStreak = sortedMonthKeys.length ? 1 : 0
  for (let i = sortedMonthKeys.length - 1; i > 0; i--) {
    const [cy, cm] = sortedMonthKeys[i].split('-').map(Number)
    const [py, pm] = sortedMonthKeys[i - 1].split('-').map(Number)
    if ((cy - py) * 12 + (cm - pm) === 1) loggingStreak++
    else break
  }

  return (
    <div style={{ width: '100%' }}>

      {/* 1. Greeting */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 48, fontWeight: 800, lineHeight: 1.1, color: 'var(--ink)', marginBottom: '0.5rem' }}>
          {greetingWord}, <span style={{ color: '#8b5cf6' }}>Sim.</span>
        </h1>
        <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 13, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          You've logged {totalFoods} foods across {totalCategories} categories. Here's where things stand.
        </p>
      </div>

      {/* 2. Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Avg Rating — purple tinted card */}
        <div style={{ background: '#1a1430', border: '1px solid #6c47d4', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: '#6c47d4', lineHeight: 1 }}>{avgRating != null ? avgRating.toFixed(2) : '—'}</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Avg Rating</div>
        </div>
        {/* Foods Logged */}
        <Card>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{totalFoods}</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Foods Logged</div>
        </Card>
        {/* Starred Faves */}
        <Card>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>{starredCount}</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Starred Faves</div>
        </Card>
        {/* Restaurants Tried */}
        <Card>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{distinctRestCount}</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Restaurants Tried</div>
        </Card>
      </div>

      {/* 3. Hall of Fame + Hall of Shame */}
      <PodiumSection top5={top5} shameList={shameList} />

      {/* 4. Reigning Champion / Fresh off the Fork */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <ReigningChampionCard
          champEntry={champEntry}
          champScore={champScore}
          champReviewCount={champReviewCount}
          champNote={champNote}
          champTaste={champTaste}
          champValue={champValue}
          champConsistency={champConsistency}
        />

        {/* Fresh off the Fork */}
        <SectionErrorBoundary title="Fresh off the Fork">
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}>🍴 Fresh off the fork</div>
            <span onClick={() => navigate('/entries')} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6c47d4', textDecoration: 'none', cursor: 'pointer' }}>All Entries →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
            {freshEntries.map(entry => (
              <div key={entry.id} onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', borderRadius: 6, background: 'var(--paper)', cursor: 'pointer' }}>
                <FlagImage code={entry.flag} />
                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{entry.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{formatReviewDate(entry.reviewDate!)}</span>
              </div>
            ))}
          </div>
        </Card>
        </SectionErrorBoundary>
      </div>

      {/* 5. Top Tables / Regulars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Top Tables */}
        <SectionErrorBoundary title="Top Tables">
        <Card>
          <SectionLabel>Top Tables</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {topTables.map((r, i) => (
              <RankRow key={r.name} rank={i + 1} name={r.name} visits={r.visits} avg={r.avg} onClick={() => navigate('/restaurants')} />
            ))}
          </div>
        </Card>
        </SectionErrorBoundary>

        {/* Regulars */}
        <SectionErrorBoundary title="Regulars">
        <Card>
          <SectionLabel>Regulars</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {regulars.map((r, i) => (
              <div key={r.name} onClick={() => navigate('/restaurants')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)', cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 14, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{r.visits}× avg {r.avg != null ? r.avg.toFixed(1) : '—'}</span>
              </div>
            ))}
          </div>
        </Card>
        </SectionErrorBoundary>
      </div>

      {/* 6. Logging Pace / Best Value */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1rem', marginBottom: '2rem' }}>
        <LoggingPaceCard
          chartData={chartData}
          chartMax={chartMax}
          chartPeakIdx={chartPeakIdx}
          avgPerMonth={avgPerMonth}
          peakMonthLabel={peakMonthLabel}
          peakMonthCount={peakMonthCount}
          loggingStreak={loggingStreak}
        />
        <BestValueCard bestValueRest={bestValueRest} bestValueItems={bestValueItems} />
      </div>

    </div>
  )
}
