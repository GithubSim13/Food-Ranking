import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'
import type { Entry } from '../../types'
import FlagImage from '../common/FlagImage'

// ─── helpers ─────────────────────────────────────────────────────────────────

function scoreColor(v: number): string {
  return `oklch(0.62 0.16 ${25 + ((v - 3) / 6.5) * 120})`
}

function entryAvg(e: Entry): number | null {
  const vals = e.reviews.map(r => r.overallRating).filter((r): r is number => r !== null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function ratingAvg(vals: (number | null)[]): number | null {
  const filtered = vals.filter((v): v is number => v !== null)
  return filtered.length ? filtered.reduce((a, b) => a + b, 0) / filtered.length : null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function firstNoteLine(notes: string | null | undefined): string {
  if (!notes) return ''
  return notes.split('\n')[0].trim()
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Card({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 14,
      padding: '1.25rem 1.5rem',
      cursor: onClick ? 'pointer' : undefined,
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.68rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      color: 'var(--ink-mute)',
      marginBottom: '0.75rem',
    }}>
      {children}
    </div>
  )
}

function RankRow({ rank, name, visits, avg, onClick }: { rank: number; name: string; visits: number; avg: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)', cursor: onClick ? 'pointer' : undefined }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 14, flexShrink: 0 }}>{rank}</span>
      <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{name}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{visits}×</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(avg), flexShrink: 0 }}>{avg.toFixed(1)}</span>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: entries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  // ── basic stats ────────────────────────────────────────────────────────────
  const totalFoods = entries.length
  const totalCategories = new Set(entries.map(e => e.category)).size
  const starredCount = entries.filter(e => e.starred).length
  const distinctRestCount = new Set(entries.map(e => e.restaurantId)).size
  const ratedEntryAvgs = entries.map(e => entryAvg(e)).filter((v): v is number => v !== null)
  const avgRating = ratedEntryAvgs.length ? ratedEntryAvgs.reduce((a, b) => a + b, 0) / ratedEntryAvgs.length : null

  // ── top 5 ──────────────────────────────────────────────────────────────────
  type Top5Entry = { id: number; name: string; flag: string | null; score: number; starred: boolean }
  const top5: Top5Entry[] = [...entries]
    .map(e => {
      let score: number | null = null
      for (let i = e.reviews.length - 1; i >= 0; i--) {
        if (e.reviews[i].overallRating !== null) { score = e.reviews[i].overallRating!; break }
      }
      return { id: e.id, name: e.foodName, flag: e.flag, score, starred: e.starred }
    })
    .filter((e): e is Top5Entry => e.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  const [p1, p2, p3, p4, p5] = top5

  // ── hall of fame / shame ───────────────────────────────────────────────────
  const entriesWithNotes = entries.filter(e => e.reviews.some(r => r.notes && r.notes.trim() !== ''))
  type RatedEntry = { entry: Entry; avg: number }
  const ratedWithNotes: RatedEntry[] = entriesWithNotes
    .map(e => ({ entry: e, avg: entryAvg(e) }))
    .filter((x): x is RatedEntry => x.avg !== null)

  const fameData = ratedWithNotes.length
    ? [...ratedWithNotes].sort((a, b) => b.avg - a.avg)[0]
    : null
  const fameNote = fameData
    ? firstNoteLine(fameData.entry.reviews.find(r => r.notes && r.notes.trim() !== '')?.notes)
    : ''

  const shameData = ratedWithNotes.length
    ? [...ratedWithNotes].sort((a, b) => a.avg - b.avg)[0]
    : null
  const shameNote = shameData
    ? firstNoteLine(shameData.entry.reviews.find(r => r.notes && r.notes.trim() !== '')?.notes)
    : ''

  // ── champion (= hall of fame entry) ───────────────────────────────────────
  const champEntry = fameData?.entry ?? null
  const champScore = fameData?.avg ?? null
  const champLatestReview = champEntry ? champEntry.reviews[champEntry.reviews.length - 1] : null
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
  const restMap = new Map<number, RestBucket>()
  entries.forEach(e => {
    if (!restMap.has(e.restaurantId))
      restMap.set(e.restaurantId, { name: e.restaurant.name, total: 0, ratedAvgs: [], valueScores: [], valueItems: [] })
    const bucket = restMap.get(e.restaurantId)!
    bucket.total++
    const avg = entryAvg(e)
    if (avg !== null) bucket.ratedAvgs.push(avg)
    const val = ratingAvg(e.reviews.map(r => r.rating2))
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

  const bestValueRest = Array.from(restMap.values())
    .filter(r => r.valueScores.length >= 2)
    .map(r => ({ ...r, avgValue: r.valueScores.reduce((a, b) => a + b, 0) / r.valueScores.length }))
    .sort((a, b) => b.avgValue - a.avgValue)[0] ?? null
  const bestValueItems = bestValueRest
    ? [...bestValueRest.valueItems].sort((a, b) => b.valueScore - a.valueScore).slice(0, 5)
    : []

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

  // ── podium layout ──────────────────────────────────────────────────────────
  const PODIUM_CONTAINER_H = 180
  const podiumOrder = (p1 && p2 && p3) ? [
    p4 ? { entry: p4, rank: 4, height: Math.round(PODIUM_CONTAINER_H * 0.28), barColor: '#1a1728', scoreOpacity: 0.35 } : null,
    { entry: p2, rank: 2, height: Math.round(PODIUM_CONTAINER_H * 0.50), barColor: '#2a2240', scoreOpacity: 0.55 },
    { entry: p1, rank: 1, height: Math.round(PODIUM_CONTAINER_H * 0.65), barColor: '#6c47d4', scoreOpacity: 1 },
    { entry: p3, rank: 3, height: Math.round(PODIUM_CONTAINER_H * 0.40), barColor: '#201b32', scoreOpacity: 0.35 },
    p5 ? { entry: p5, rank: 5, height: Math.round(PODIUM_CONTAINER_H * 0.18), barColor: '#1a1728', scoreOpacity: 0.35 } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null) : []

  return (
    <div style={{ width: '100%' }}>

      {/* 1. Greeting */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 48, fontWeight: 800, lineHeight: 1.1, color: 'var(--ink)', marginBottom: '0.5rem' }}>
          Morning, <span style={{ color: '#8b5cf6' }}>Sim.</span>
        </h1>
        <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 13, color: '#9b8fc0', lineHeight: 1.5 }}>
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: '#e6a817', lineHeight: 1 }}>{starredCount}</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Starred Faves</div>
        </Card>
        {/* Restaurants Tried */}
        <Card>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{distinctRestCount}</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Restaurants Tried</div>
        </Card>
      </div>

      {/* 3. Top 5 Podium */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}>🏆 Top 5</div>
          <span onClick={() => navigate('/rankings')} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6c47d4', textDecoration: 'none', cursor: 'pointer' }}>All Rankings →</span>
        </div>

        {/* Podium bars */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '0.75rem' }}>
          {podiumOrder.map(({ entry, rank, height, barColor, scoreOpacity }) => (
            <div key={entry.id} onClick={() => navigate(`/entries/${entry.id}`, { state: { background: location } })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0, cursor: 'pointer' }}>
              {/* Info above bar */}
              <div style={{ textAlign: 'center', marginBottom: '0.5rem', padding: '0 0.25rem', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: rank <= 3 ? '0.85rem' : '0.75rem', fontWeight: 600, color: rank <= 3 ? 'var(--ink)' : 'var(--ink-mute)', marginBottom: '0.2rem' }}>
                  <FlagImage code={entry.flag} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: rank <= 3 ? '0.82rem' : '0.72rem', fontWeight: 700, color: scoreColor(entry.score), opacity: scoreOpacity }}>
                  {entry.score.toFixed(2)}
                </div>
              </div>
              {/* Bar */}
              <div style={{
                width: '100%',
                height,
                background: barColor,
                borderRadius: '6px 6px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: rank === 1 ? '1.5rem' : '1.1rem',
                  color: `rgba(255,255,255,${scoreOpacity})`,
                }}>
                  {rank}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 4. Hall of Fame / Hall of Shame */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Hall of Fame */}
        <div onClick={() => fameData && navigate(`/entries/${fameData.entry.id}`, { state: { background: location } })} style={{ background: 'var(--surface)', borderLeft: '4px solid #4caf82', borderRadius: 14, padding: '1.25rem 1.5rem', cursor: fameData ? 'pointer' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4caf82' }}>▲ Hall of Fame</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: '#4caf82', lineHeight: 1 }}>{fameData ? fameData.avg.toFixed(2) : '—'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: '0.25rem' }}>
            <FlagImage code={fameData?.entry.flag ?? null} />
            {fameData?.entry.foodName ?? '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)', marginBottom: '0.5rem' }}>{fameData?.entry.restaurant.name ?? '—'} · {fameData?.entry.category ?? '—'}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-mute)', fontStyle: 'italic' }}>"{fameNote}"</div>
        </div>

        {/* Hall of Shame */}
        <div onClick={() => shameData && navigate(`/entries/${shameData.entry.id}`, { state: { background: location } })} style={{ background: 'var(--surface)', borderLeft: '4px solid #e07a40', borderRadius: 14, padding: '1.25rem 1.5rem', cursor: shameData ? 'pointer' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#e07a40' }}>▼ Hall of Shame</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: '#e07a40', lineHeight: 1 }}>{shameData ? shameData.avg.toFixed(2) : '—'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: '0.25rem' }}>
            <FlagImage code={shameData?.entry.flag ?? null} />
            {shameData?.entry.foodName ?? '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)', marginBottom: '0.5rem' }}>{shameData?.entry.restaurant.name ?? '—'} · {shameData?.entry.category ?? '—'}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-mute)', fontStyle: 'italic' }}>"{shameNote}"</div>
        </div>
      </div>

      {/* 5. Reigning Champion / Fresh off the Fork */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Reigning Champion */}
        <div onClick={() => champEntry && navigate(`/entries/${champEntry.id}`, { state: { background: location } })} style={{
          position: 'relative',
          background: '#6c47d4',
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 14px)',
          borderRadius: 14,
          padding: '1.5rem',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'center',
          gap: 4,
          cursor: champEntry ? 'pointer' : undefined,
        }}>
          {/* Gold score badge — top-right */}
          <div style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: '#e6a817',
            color: '#0f0d17',
            fontFamily: 'var(--font-mono)',
            fontSize: '1.5rem',
            fontWeight: 700,
            lineHeight: 1,
            padding: '0.25rem 0.6rem',
            borderRadius: 8,
          }}>
            {champScore != null ? champScore.toFixed(2) : '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)' }}>
            ★ Reigning Champion
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.03em', color: '#ffffff', flexWrap: 'wrap' as const }}>
            <FlagImage code={champEntry?.flag ?? null} />
            {champEntry?.foodName ?? '—'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
            {champEntry?.restaurant.name ?? '—'} · {champEntry?.category ?? '—'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#d4c0f8', fontStyle: 'italic' }}>
            {champNote ? `"${champNote}"` : ''}
          </div>
          {/* Rating breakdown */}
          {(champTaste != null || champValue != null || champConsistency != null) && (
            <div style={{ display: 'flex', gap: '1.5rem', paddingTop: 4 }}>
              {[
                { label: 'Taste', value: champTaste },
                { label: 'Value', value: champValue },
                { label: 'Consistency', value: champConsistency },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#c4abff', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>
                    {value != null ? value.toFixed(1) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fresh off the Fork */}
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{formatDate(entry.reviewDate!)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 6. Top Tables / Regulars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Top Tables */}
        <Card>
          <SectionLabel>Top Tables</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {topTables.map((r, i) => (
              <RankRow key={r.name} rank={i + 1} name={r.name} visits={r.visits} avg={r.avg} onClick={() => navigate('/restaurants')} />
            ))}
          </div>
        </Card>

        {/* Regulars */}
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
      </div>

      {/* 7. Logging Pace / Best Value */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1rem', marginBottom: '2rem' }}>
        {/* Logging Pace */}
        <Card>
          <SectionLabel>Logging Pace</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '1.25rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{avgPerMonth.toFixed(1)}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-mute)' }}>/ month</span>
          </div>

          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', height: 90, marginBottom: '0.75rem', gap: 4 }}>
            {chartData.map((m, i) => {
              const barH = Math.max(4, Math.round((m.count / chartMax) * 72))
              const isPeak = i === chartPeakIdx
              return (
                <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%',
                    height: barH,
                    background: isPeak ? '#8b5cf6' : 'var(--accent)',
                    opacity: isPeak ? 1 : 0.35,
                    borderRadius: '3px 3px 0 0',
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--ink-mute)' }}>{m.label}</span>
                </div>
              )
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)' }}>
            Busiest was <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{peakMonthLabel}</span> ({peakMonthCount} foods) · {loggingStreak}-month streak
          </div>
        </Card>

        {/* Best Value */}
        <Card onClick={() => navigate('/restaurants')} style={{ display: 'flex', gap: '1.25rem', overflow: 'hidden' }}>
          {/* Left: summary */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-mute)', marginBottom: '0.4rem' }}>★ Best Value Spot</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: '#e6a817', lineHeight: 1, marginBottom: '0.35rem' }}>
              {bestValueRest ? bestValueRest.avgValue.toFixed(1) : '—'}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', marginBottom: '0.2rem' }}>
              {bestValueRest?.name ?? '—'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)' }}>
              avg Value score · {bestValueRest?.total ?? 0} visits
            </div>
          </div>
          {/* Divider */}
          <div style={{ width: 1, background: 'var(--line)', flexShrink: 0, alignSelf: 'stretch' }} />
          {/* Right: entry list */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem', justifyContent: 'center' }}>
            {bestValueItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)', minWidth: 0 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(item.valueScore), flexShrink: 0 }}>{item.valueScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  )
}
