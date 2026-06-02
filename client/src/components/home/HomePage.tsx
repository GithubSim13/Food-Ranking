import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'
import type { Entry } from '../../types'

// ─── helpers ────────────────────────────────────────────────────────────────

function entryAvg(e: Entry): number | null {
  const vals = e.reviews.map(r => r.overallRating).filter((r): r is number => r !== null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function scoreColor(v: number): string {
  return `oklch(0.62 0.16 ${25 + ((v - 3) / 6.5) * 120})`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en', { month: 'short', year: '2-digit' })
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en', { month: 'short', day: 'numeric' })
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
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

function StatCard({ value, label, valueColor }: { value: string; label: string; valueColor?: string }) {
  return (
    <SectionCard>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: valueColor ?? 'var(--ink)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
    </SectionCard>
  )
}

interface PodiumStepProps {
  entry: Entry
  rank: number
  stepHeight: number
  onNavigate: () => void
}

function PodiumStep({ entry, rank, stepHeight, onNavigate }: PodiumStepProps) {
  const avg = entryAvg(entry)
  return (
    <div
      onClick={onNavigate}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', width: 140 }}
    >
      {/* Info above step */}
      <div style={{ textAlign: 'center', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
        <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 600, color: 'var(--ink)' }}>
          <FlagImage code={entry.flag} />
          <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.foodName}</span>
        </div>
        {avg != null && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: scoreColor(avg), marginTop: '0.2rem' }}>
            {avg.toFixed(2)}
          </div>
        )}
      </div>
      {/* Step */}
      <div style={{
        width: '100%',
        height: stepHeight,
        background: rank === 1 ? 'var(--accent-wash)' : 'var(--line-soft)',
        borderTop: `3px solid ${rank === 1 ? 'var(--accent)' : rank === 2 ? 'var(--ink-mute)' : 'var(--line)'}`,
        borderRadius: '6px 6px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: rank === 1 ? '1.5rem' : '1.1rem',
          color: rank === 1 ? 'var(--accent)' : 'var(--ink-mute)',
        }}>
          {rank}
        </span>
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries'],
    queryFn: getEntries,
  })

  if (isLoading) return <p style={{ color: 'var(--ink-mute)' }}>Loading…</p>
  if (entries.length === 0) {
    return (
      <div>
        <p style={kickerStyle}>{greeting()}, Sim.</p>
        <h1 style={pageTitleStyle}>Nothing logged yet.</h1>
        <p style={{ color: 'var(--ink-mute)', marginTop: '0.5rem' }}>
          <Link to="/entries/new" style={{ color: 'var(--accent)' }}>Add your first entry</Link> to get started.
        </p>
      </div>
    )
  }

  // ── stats ──────────────────────────────────────────────────────────────────
  const allRatings = entries.flatMap(e =>
    e.reviews.map(r => r.overallRating).filter((r): r is number => r !== null)
  )
  const avgAll = allRatings.length
    ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
    : null

  const rated = entries.filter(e => entryAvg(e) !== null)
  const byScore = [...rated].sort((a, b) => entryAvg(b)! - entryAvg(a)!)
  const earliestReviewDate = (e: Entry): number => {
    const dates = e.reviews.map(r => r.date).filter((d): d is string => d !== null)
    return dates.length ? new Date(dates.sort()[0]).getTime() : 0
  }
  const byDate = [...entries].sort((a, b) => earliestReviewDate(b) - earliestReviewDate(a))
  const categoryCount = new Set(entries.map(e => e.category)).size
  const restaurantCount = new Set(entries.map(e => e.restaurant.name)).size
  const starredCount = entries.filter(e => e.starred).length

  // restaurant aggregates
  type RestAgg = { restaurantId: number; name: string; visits: number; avgRating: number | null }
  const restMap = new Map<number, { name: string; allRatings: number[]; count: number }>()
  entries.forEach(e => {
    if (!restMap.has(e.restaurantId)) restMap.set(e.restaurantId, { name: e.restaurant.name, allRatings: [], count: 0 })
    const r = restMap.get(e.restaurantId)!
    r.count++
    e.reviews.forEach(rv => { if (rv.overallRating != null) r.allRatings.push(rv.overallRating) })
  })
  const restAggs: RestAgg[] = Array.from(restMap.entries()).map(([id, r]) => ({
    restaurantId: id,
    name: r.name,
    visits: r.count,
    avgRating: r.allRatings.length ? r.allRatings.reduce((a, b) => a + b, 0) / r.allRatings.length : null,
  }))
  const topTables = restAggs
    .filter(r => r.visits >= 2 && r.avgRating != null)
    .sort((a, b) => b.avgRating! - a.avgRating!)
    .slice(0, 5)
  const regulars = [...restAggs].sort((a, b) => b.visits - a.visits).slice(0, 5)
  const topRatedRest = topTables[0] ?? null

  // monthly pace (by earliest non-null review date)
  const byMonth = new Map<string, number>()
  entries.forEach(e => {
    const dates = e.reviews.map(r => r.date).filter((d): d is string => d !== null)
    if (dates.length === 0) return
    const earliest = dates.sort()[0]
    const key = earliest.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
  })
  const monthKeys = Array.from(byMonth.keys()).sort()
  const perMonth = monthKeys.length ? entries.length / monthKeys.length : 0
  const busiestMonth = monthKeys.length
    ? monthKeys.reduce((a, b) => (byMonth.get(b)! > byMonth.get(a)! ? b : a))
    : ''
  let streak = 0
  if (monthKeys.length) {
    const latestParts = monthKeys[monthKeys.length - 1].split('-').map(Number)
    for (let i = 0; ; i++) {
      const d = new Date(latestParts[0], latestParts[1] - 1 - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth.has(key)) break
      streak++
    }
  }
  const maxMonthCount = Math.max(...Array.from(byMonth.values()), 1)
  // show at most last 18 months on chart
  const chartMonths = monthKeys.slice(-18)

  // hall of fame / shame
  const famEntry = byScore[0]
  const shameEntry = byScore.length > 1 ? byScore[byScore.length - 1] : null
  const famAvg = famEntry ? entryAvg(famEntry) : null
  const shameAvg = shameEntry ? entryAvg(shameEntry) : null

  const openEntry = (id: number) => navigate(`/entries/${id}`, { state: { background: location } })

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 960 }}>
      {/* 1. Greeting */}
      <div style={{ marginBottom: '2rem' }}>
        <p style={kickerStyle}>{greeting()}, Sim.</p>
        <h1 style={pageTitleStyle}>
          You've logged {entries.length} foods across {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}.
        </h1>
        <p style={{ color: 'var(--ink-mute)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Here's where things stand.
        </p>
      </div>

      {/* 2. Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard
          value={avgAll != null ? avgAll.toFixed(2) : '—'}
          label="avg rating · all time"
          valueColor={avgAll != null ? scoreColor(avgAll) : 'var(--ink-mute)'}
        />
        <StatCard value={String(entries.length)} label="foods logged" />
        <StatCard value={String(starredCount)} label="starred faves" valueColor="var(--gold)" />
        <StatCard value={String(restaurantCount)} label="restaurants tried" />
      </div>

      {/* 3. Top 5 podium */}
      {byScore.length >= 3 && (
        <SectionCard style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={sectionTitleStyle}>Top 5</h2>
            <Link to="/rankings" style={linkStyle}>All rankings →</Link>
          </div>
          {/* Podium steps: 2nd, 1st, 3rd */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {([byScore[1], byScore[0], byScore[2]] as const).map((entry, i) => (
              entry ? (
                <PodiumStep
                  key={entry.id}
                  entry={entry}
                  rank={[2, 1, 3][i]}
                  stepHeight={[80, 120, 60][i]}
                  onNavigate={() => openEntry(entry.id)}
                />
              ) : null
            ))}
          </div>
          {/* Ranks 4–5 */}
          {byScore.length >= 4 && (
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
              {byScore.slice(3, 5).map((entry, i) => {
                const avg = entryAvg(entry)
                return (
                  <div
                    key={entry.id}
                    onClick={() => openEntry(entry.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--paper)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-mute)', width: 16 }}>{i + 4}</span>
                    <FlagImage code={entry.flag} />
                    <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 500 }}>{entry.foodName}</span>
                    {avg != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: scoreColor(avg), fontWeight: 700 }}>{avg.toFixed(2)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* 4. Hall of Fame / Shame */}
      {byScore.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Fame */}
          <div
            onClick={() => openEntry(famEntry.id)}
            style={{ background: 'var(--accent-wash)', border: '1px solid var(--accent)', borderRadius: 14, padding: '1.25rem 1.5rem', cursor: 'pointer' }}
          >
            <p style={{ ...kickerStyle, color: 'var(--accent)' }}>Hall of Fame</p>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <FlagImage code={famEntry.flag} />
              {famEntry.foodName}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-mute)', marginBottom: '0.5rem' }}>
              {famEntry.restaurant.name} · {famEntry.category}
            </div>
            {famAvg != null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: scoreColor(famAvg), lineHeight: 1 }}>
                {famAvg.toFixed(2)}
              </div>
            )}
          </div>
          {/* Shame */}
          {shameEntry && (
            <div
              onClick={() => openEntry(shameEntry.id)}
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '1.25rem 1.5rem', cursor: 'pointer' }}
            >
              <p style={{ ...kickerStyle }}>Hall of Shame</p>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FlagImage code={shameEntry.flag} />
                {shameEntry.foodName}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--ink-mute)', marginBottom: '0.5rem' }}>
                {shameEntry.restaurant.name} · {shameEntry.category}
              </div>
              {shameAvg != null && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: scoreColor(shameAvg), lineHeight: 1 }}>
                  {shameAvg.toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Champion + Fresh off the fork */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Champion */}
        {famEntry && (
          <div
            onClick={() => openEntry(famEntry.id)}
            style={{ background: 'var(--accent-wash)', border: '1px solid var(--accent)', borderRadius: 14, padding: '1.5rem', cursor: 'pointer' }}
          >
            <p style={{ ...kickerStyle, color: 'var(--accent)' }}>Reigning Champion</p>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <FlagImage code={famEntry.flag} />
              {famEntry.foodName}
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--ink-mute)', marginBottom: '0.75rem' }}>
              {famEntry.restaurant.name} · {famEntry.category}
            </div>
            {famAvg != null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: scoreColor(famAvg), lineHeight: 1 }}>
                {famAvg.toFixed(2)}
              </div>
            )}
          </div>
        )}
        {/* Fresh off the fork */}
        <SectionCard style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: '0.875rem' }}>Fresh off the fork</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            {byDate.slice(0, 5).map(entry => (
              <div
                key={entry.id}
                onClick={() => openEntry(entry.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.35rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}
              >
                <FlagImage code={entry.flag} />
                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.foodName}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', flexShrink: 0 }}>
                  {(() => { const d = entry.reviews.map(r => r.date).filter((d): d is string => d !== null).sort()[0]; return d ? formatDay(d) : '' })()}
                </span>
              </div>
            ))}
          </div>
          <Link to="/entries" style={{ ...linkStyle, display: 'block', marginTop: '0.75rem', fontSize: '0.8rem' }}>All entries →</Link>
        </SectionCard>
      </div>

      {/* 6. Top Tables + Regulars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Top Tables */}
        <SectionCard>
          <h2 style={{ ...sectionTitleStyle, marginBottom: '0.875rem' }}>Top Tables</h2>
          {topTables.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-mute)' }}>No restaurants with 2+ visits yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {topTables.map((r, i) => (
                <div
                  key={r.restaurantId}
                  onClick={() => navigate('/restaurants')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', width: 14 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500 }}>{r.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{r.visits}×</span>
                  {r.avgRating != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(r.avgRating), flexShrink: 0 }}>{r.avgRating.toFixed(1)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        {/* Regulars */}
        <SectionCard>
          <h2 style={{ ...sectionTitleStyle, marginBottom: '0.875rem' }}>Regulars</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {regulars.map((r, i) => (
              <div
                key={r.restaurantId}
                onClick={() => navigate('/restaurants')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)' }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)', width: 14 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{r.visits} visits</span>
                {r.avgRating != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(r.avgRating), flexShrink: 0 }}>{r.avgRating.toFixed(1)}</span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* 7. Logging pace + Top Rated Restaurant */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1rem', marginBottom: '2rem' }}>
        {/* Logging pace */}
        <SectionCard>
          <h2 style={{ ...sectionTitleStyle, marginBottom: '1rem' }}>Logging pace</h2>
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: 100, marginBottom: '0.5rem' }}>
            {chartMonths.map(key => {
              const count = byMonth.get(key) ?? 0
              const height = Math.max(4, Math.round((count / maxMonthCount) * 80))
              const isLatest = key === monthKeys[monthKeys.length - 1]
              const isBusiest = key === busiestMonth
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: 18,
                    height,
                    background: isBusiest ? 'var(--gold)' : isLatest ? 'var(--accent)' : 'var(--accent)',
                    opacity: isBusiest ? 1 : isLatest ? 1 : 0.45,
                    borderRadius: '3px 3px 0 0',
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--ink-mute)', transform: 'rotate(-45deg)', transformOrigin: 'center', marginTop: 2 }}>
                    {new Date(key + '-15').toLocaleString('en', { month: 'short' }).slice(0, 1)}
                  </span>
                </div>
              )
            })}
          </div>
          {/* Stats below chart */}
          <div style={{ display: 'flex', gap: '1.5rem', borderTop: '1px solid var(--line)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' }}>{perMonth.toFixed(1)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>per month</div>
            </div>
            {busiestMonth && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)' }}>{formatMonth(busiestMonth)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>busiest month ({byMonth.get(busiestMonth)} entries)</div>
              </div>
            )}
            {streak > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>{streak}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>month streak</div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Top Rated Restaurant */}
        <SectionCard style={{ display: 'flex', flexDirection: 'column' }}>
          <p style={kickerStyle}>Award</p>
          <h2 style={{ ...sectionTitleStyle, marginBottom: '0.5rem' }}>Top Rated</h2>
          {topRatedRest ? (
            <div
              onClick={() => navigate('/restaurants')}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', fontWeight: 700, color: scoreColor(topRatedRest.avgRating!), lineHeight: 1, marginBottom: '0.5rem' }}>
                {topRatedRest.avgRating!.toFixed(1)}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', marginBottom: '0.25rem' }}>
                {topRatedRest.name}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-mute)' }}>
                {topRatedRest.visits} visits
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-mute)', flex: 1 }}>
              No restaurants with 2+ visits yet.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── style constants ──────────────────────────────────────────────────────────

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
  fontSize: '1.75rem',
  letterSpacing: '-0.03em',
  color: 'var(--ink)',
}

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: '1rem',
  letterSpacing: '-0.02em',
  color: 'var(--ink)',
}

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'none',
  fontSize: '0.85rem',
  fontWeight: 500,
}
