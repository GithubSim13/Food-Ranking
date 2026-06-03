import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'
import type { Entry } from '../../types'
import FlagImage from '../common/FlagImage'

// ─── placeholder data ────────────────────────────────────────────────────────

const TOP5 = [
  { id: 1, name: 'Tonkotsu Ramen', flag: 'JP', score: 9.42 },
  { id: 2, name: 'Hainanese Chicken Rice', flag: 'SG', score: 9.08 },
  { id: 3, name: 'Rendang', flag: 'MY', score: 8.87 },
  { id: 4, name: 'Peking Duck', flag: 'CN', score: 8.64 },
  { id: 5, name: 'Tteokbokki', flag: 'KR', score: 8.31 },
]

const FAME = {
  name: 'Tonkotsu Ramen',
  restaurant: 'Ippudo',
  category: 'Ramen',
  quote: 'Rich, umami-packed broth with perfectly chewy noodles.',
  score: 9.42,
  flag: 'JP',
}

const SHAME = {
  name: 'Soggy Nachos',
  restaurant: "Chili's",
  category: 'Tex-Mex',
  quote: 'Somehow soggy and stale at the same time.',
  score: 4.21,
  flag: null as string | null,
}

const CHAMPION = {
  name: 'Tonkotsu Ramen',
  restaurant: 'Ippudo',
  category: 'Ramen',
  score: 9.42,
  flag: 'JP',
}

const FRESH = [
  { id: 6, name: 'Laksa', flag: 'MY', date: 'Jun 1' },
  { id: 7, name: 'Croissant', flag: 'FR', date: 'May 28' },
  { id: 8, name: 'Char Siu Bao', flag: 'HK', date: 'May 22' },
  { id: 9, name: 'Birria Tacos', flag: 'MX', date: 'May 17' },
  { id: 10, name: 'Matcha Parfait', flag: 'JP', date: 'May 10' },
]

const TOP_TABLES = [
  { name: 'Ippudo', visits: 3, avg: 9.1 },
  { name: 'Jollibee', visits: 5, avg: 8.7 },
  { name: 'Din Tai Fung', visits: 4, avg: 8.4 },
  { name: 'Zus Coffee', visits: 3, avg: 8.3 },
  { name: "Nando's", visits: 3, avg: 8.2 },
]

const REGULARS = [
  { name: 'Jollibee', visits: 5, avg: 7.8 },
  { name: 'Din Tai Fung', visits: 4, avg: 8.4 },
  { name: "McDonald's", visits: 4, avg: 6.1 },
  { name: 'Ippudo', visits: 3, avg: 9.1 },
  { name: 'Zus Coffee', visits: 3, avg: 8.3 },
]

const CHART = [
  { label: 'M', count: 4 },
  { label: 'A', count: 6 },
  { label: 'M', count: 5 },
  { label: 'J', count: 8 },
  { label: 'J', count: 7 },
  { label: 'A', count: 18 },
  { label: 'S', count: 4 },
  { label: 'O', count: 3 },
]
const CHART_MAX = 18
const CHART_PEAK = 5

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

// ─── sub-components ──────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 14,
      padding: '1.25rem 1.5rem',
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

function RankRow({ rank, name, visits, avg }: { rank: number; name: string; visits: number; avg: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 14, flexShrink: 0 }}>{rank}</span>
      <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{name}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{visits}×</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(avg), flexShrink: 0 }}>{avg.toFixed(1)}</span>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: entries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  // ── champion data ──────────────────────────────────────────────────────────
  const rated = entries.filter(e => entryAvg(e) !== null)
  const champEntry = rated.length
    ? rated.reduce((best, e) => entryAvg(e)! > entryAvg(best)! ? e : best)
    : null
  const champScore = champEntry ? entryAvg(champEntry) : null
  const champTaste = champEntry ? ratingAvg(champEntry.reviews.map(r => r.rating1)) : null
  const champValue = champEntry ? ratingAvg(champEntry.reviews.map(r => r.rating2)) : null
  const champConsistency = champEntry ? ratingAvg(champEntry.reviews.map(r => r.rating3)) : null
  const champQuote = champEntry?.reviews.find(r => r.rating1 !== null) as { rating1: number | null } | undefined

  // ── best value restaurant ──────────────────────────────────────────────────
  type RestBucket = { name: string; visits: number; valueScores: number[]; items: { name: string; valueScore: number }[] }
  const restMap = new Map<number, RestBucket>()
  entries.forEach(e => {
    if (!restMap.has(e.restaurantId))
      restMap.set(e.restaurantId, { name: e.restaurant.name, visits: 0, valueScores: [], items: [] })
    const bucket = restMap.get(e.restaurantId)!
    bucket.visits++
    const entryVal = ratingAvg(e.reviews.map(r => r.rating2))
    if (entryVal !== null) {
      bucket.valueScores.push(entryVal)
      bucket.items.push({ name: e.foodName, valueScore: entryVal })
    }
  })
  const bestValueRest = Array.from(restMap.values())
    .filter(r => r.valueScores.length > 0)
    .map(r => ({ ...r, avgValue: r.valueScores.reduce((a, b) => a + b, 0) / r.valueScores.length }))
    .sort((a, b) => b.avgValue - a.avgValue)[0] ?? null
  const bestValueItems = bestValueRest
    ? [...bestValueRest.items].sort((a, b) => b.valueScore - a.valueScore).slice(0, 5)
    : []

  const [p1, p2, p3, p4, p5] = TOP5

  const PODIUM_CONTAINER_H = 180
  // podium order: 2nd, 1st, 3rd — heights as % of container
  const podiumOrder = [
    { entry: p2, rank: 2, height: Math.round(PODIUM_CONTAINER_H * 0.45), barColor: '#2a2240' },
    { entry: p1, rank: 1, height: Math.round(PODIUM_CONTAINER_H * 0.65), barColor: '#6c47d4' },
    { entry: p3, rank: 3, height: Math.round(PODIUM_CONTAINER_H * 0.30), barColor: '#201b32' },
  ]

  return (
    <div style={{ width: '100%' }}>

      {/* 1. Greeting */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 48, fontWeight: 800, lineHeight: 1.1, color: 'var(--ink)', marginBottom: '0.5rem' }}>
          Morning, <span style={{ color: '#8b5cf6' }}>Sim.</span>
        </h1>
        <p style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 13, color: '#9b8fc0', lineHeight: 1.5 }}>
          You've logged 55 foods across 24 categories. Here's where things stand.
        </p>
      </div>

      {/* 2. Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Avg Rating — purple tinted card */}
        <div style={{ background: '#1a1430', border: '1px solid #6c47d4', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: '#6c47d4', lineHeight: 1 }}>7.51</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Avg Rating</div>
        </div>
        {/* Foods Logged */}
        <Card>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>55</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Foods Logged</div>
        </Card>
        {/* Starred Faves */}
        <Card>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: '#e6a817', lineHeight: 1 }}>14</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Starred Faves</div>
        </Card>
        {/* Restaurants Tried */}
        <Card>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>44</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Restaurants Tried</div>
        </Card>
      </div>

      {/* 3. Top 5 Podium */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}>🏆 Top 5</div>
          <Link to="/rankings" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6c47d4', textDecoration: 'none' }}>All Rankings →</Link>
        </div>

        {/* Podium bars */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.5rem' }}>
          {podiumOrder.map(({ entry, rank, height, barColor }) => (
            <div key={entry.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 140 }}>
              {/* Info above bar */}
              <div style={{ textAlign: 'center', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.2rem' }}>
                  <FlagImage code={entry.flag} />
                  <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(entry.score) }}>
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
                  color: rank === 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                }}>
                  {rank}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Ranks 4 & 5 */}
        <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
          {[p4, p5].map((entry, i) => (
            <div key={entry.id} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--paper)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 14, flexShrink: 0 }}>{i + 4}</span>
              <FlagImage code={entry.flag} />
              <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 500 }}>{entry.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: scoreColor(entry.score) }}>{entry.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 4. Hall of Fame / Hall of Shame */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Hall of Fame */}
        <div style={{ background: 'var(--surface)', borderLeft: '4px solid #4caf82', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4caf82' }}>▲ Hall of Fame</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: '#4caf82', lineHeight: 1 }}>{FAME.score.toFixed(2)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: '0.25rem' }}>
            <FlagImage code={FAME.flag} />
            {FAME.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)', marginBottom: '0.5rem' }}>{FAME.restaurant} · {FAME.category}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-mute)', fontStyle: 'italic' }}>"{FAME.quote}"</div>
        </div>

        {/* Hall of Shame */}
        <div style={{ background: 'var(--surface)', borderLeft: '4px solid #e07a40', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#e07a40' }}>▼ Hall of Shame</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: '#e07a40', lineHeight: 1 }}>{SHAME.score.toFixed(2)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: '0.25rem' }}>
            <FlagImage code={SHAME.flag} />
            {SHAME.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)', marginBottom: '0.5rem' }}>{SHAME.restaurant} · {SHAME.category}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-mute)', fontStyle: 'italic' }}>"{SHAME.quote}"</div>
        </div>
      </div>

      {/* 5. Reigning Champion / Fresh off the Fork */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Reigning Champion */}
        <div style={{
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
            {champScore != null ? champScore.toFixed(2) : CHAMPION.score.toFixed(2)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)' }}>
            ★ Reigning Champion
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.03em', color: '#ffffff', flexWrap: 'wrap' as const }}>
            <FlagImage code={champEntry?.flag ?? CHAMPION.flag} />
            {champEntry?.foodName ?? CHAMPION.name}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
            {champEntry?.restaurant.name ?? CHAMPION.restaurant} · {champEntry?.category ?? CHAMPION.category}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#d4c0f8', fontStyle: 'italic' }}>
            "Rich, umami-packed broth with perfectly chewy noodles."
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
            <Link to="/entries" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6c47d4', textDecoration: 'none' }}>All Entries →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
            {FRESH.map(entry => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}>
                <FlagImage code={entry.flag} />
                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{entry.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{entry.date}</span>
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
            {TOP_TABLES.map((r, i) => (
              <RankRow key={r.name} rank={i + 1} name={r.name} visits={r.visits} avg={r.avg} />
            ))}
          </div>
        </Card>

        {/* Regulars */}
        <Card>
          <SectionLabel>Regulars</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {REGULARS.map((r, i) => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 14, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{r.visits}× avg {r.avg.toFixed(1)}</span>
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>6.9</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-mute)' }}>/ month</span>
          </div>

          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', height: 90, marginBottom: '0.75rem', gap: 4 }}>
            {CHART.map((m, i) => {
              const barH = Math.max(4, Math.round((m.count / CHART_MAX) * 72))
              const isPeak = i === CHART_PEAK
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
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
            Busiest was <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Aug '25</span> (18 foods) · 8-month streak
          </div>
        </Card>

        {/* Best Value */}
        <Card style={{ display: 'flex', gap: '1.25rem' }}>
          {/* Left: summary */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-mute)', marginBottom: '0.4rem' }}>★ Best Value Spot</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: '#e6a817', lineHeight: 1, marginBottom: '0.35rem' }}>
              {bestValueRest ? bestValueRest.avgValue.toFixed(1) : '8.3'}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', marginBottom: '0.2rem' }}>
              {bestValueRest?.name ?? 'Zus Coffee'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)' }}>
              avg Value score · {bestValueRest?.visits ?? 3} visits
            </div>
          </div>
          {/* Divider */}
          <div style={{ width: 1, background: 'var(--line)', flexShrink: 0, alignSelf: 'stretch' }} />
          {/* Right: entry list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem', justifyContent: 'center' }}>
            {bestValueItems.length > 0 ? bestValueItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}>
                <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(item.valueScore), flexShrink: 0 }}>{item.valueScore.toFixed(1)}</span>
              </div>
            )) : (
              // fallback placeholder rows
              [
                { name: 'Iced Caramel Latte', valueScore: 8.5 },
                { name: 'Matcha Latte', valueScore: 8.3 },
                { name: 'Cold Brew', valueScore: 8.1 },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}>
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 500 }}>{item.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(item.valueScore) }}>{item.valueScore.toFixed(1)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

    </div>
  )
}
