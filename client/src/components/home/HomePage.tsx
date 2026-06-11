import { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntries } from '../../api/entries'
import FlagImage from '../common/FlagImage'
import { sortReviewsByDateDesc, latestRating, latestRatedReview, formatReviewDate } from '../../utils'
import SectionErrorBoundary from '../common/SectionErrorBoundary'
import { Card, firstNoteLine, type Top5Entry } from './HomeShared'
import PodiumSection from './PodiumSection'
import ReigningChampionCard from './ReigningChampionCard'
import { kickerStyle } from '../common/pageStyles'

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: entries = [] } = useQuery({ queryKey: ['entries'], queryFn: getEntries })

  const hour = new Date().getHours()
  const greetingWord = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'

  // ── basic stats ────────────────────────────────────────────────────────────
  const { totalFoods, totalCategories, starredCount, distinctRestCount } = useMemo(() => ({
    totalFoods: entries.length,
    totalCategories: new Set(entries.map(e => e.category)).size,
    starredCount: entries.filter(e => e.starred).length,
    distinctRestCount: new Set(entries.map(e => e.restaurantId)).size,
  }), [entries])
  // ── top 5 ──────────────────────────────────────────────────────────────────
  const top5 = useMemo<Top5Entry[]>(() => [...entries]
    .map(e => {
      const score = latestRating(e.reviews)
      const quote = firstNoteLine(sortReviewsByDateDesc(e.reviews)[0]?.notes)
      return { id: e.id, name: e.foodName, flag: e.flag, score, starred: e.starred, category: e.category, restaurant: e.restaurant.name, reviewCount: e.reviews.length, quote }
    })
    .filter((e): e is Top5Entry => e.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5), [entries])

  // ── hall of shame ──────────────────────────────────────────────────────────
  const shameList = useMemo<Top5Entry[]>(() => [...entries]
    .map(e => {
      const score = latestRating(e.reviews)
      const quote = firstNoteLine(sortReviewsByDateDesc(e.reviews)[0]?.notes)
      return { id: e.id, name: e.foodName, flag: e.flag, score, starred: e.starred, category: e.category, restaurant: e.restaurant.name, reviewCount: e.reviews.length, quote }
    })
    .filter((e): e is Top5Entry => e.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5), [entries])

  // ── champion (most-reviewed entry, tiebreak by overallRating desc) ─────────
  const champData = useMemo(() => [...entries]
    .filter(e => e.starred && e.reviews.length > 0)
    .map(e => ({ entry: e, reviewCount: e.reviews.length, avg: latestRating(e.reviews) }))
    .sort((a, b) => b.reviewCount - a.reviewCount || (b.avg ?? 0) - (a.avg ?? 0))[0] ?? null, [entries])
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
  const freshEntries = useMemo(() => [...entries]
    .map(e => {
      const dates = e.reviews.map(r => r.date).filter((d): d is string => d !== null)
      const earliest = dates.sort()[0] ?? null
      return { id: e.id, name: e.foodName, flag: e.flag, reviewDate: earliest }
    })
    .filter(e => e.reviewDate !== null)
    .sort((a, b) => new Date(b.reviewDate!).getTime() - new Date(a.reviewDate!).getTime())
    .slice(0, 5), [entries])

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
        {/* Categories */}
        <Card>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{totalCategories}</div>
          <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>Categories</div>
        </Card>
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

      {/* 5. About */}
      <SectionErrorBoundary title="About">
        <Card style={{ position: 'relative', overflow: 'hidden', marginBottom: '1.5rem' }}>
          {/* Watermark */}
          <div style={{ position: 'absolute', bottom: '-1rem', left: '50%', transform: 'translateX(-50%)', fontSize: '10rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--ink)', opacity: 0.04, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>
            Food Ranking
          </div>
          {/* Foreground */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '3rem', padding: '2rem', alignItems: 'center' }}>
            {/* Left column */}
            <div style={{ flex: '0 0 60%' }}>
              <div style={kickerStyle}>ABOUT</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-display)', margin: '0.4rem 0 1rem' }}>Why I built this</h2>
              <p style={{ color: 'var(--ink-mute)', lineHeight: 1.7, fontFamily: 'var(--font-body)', fontSize: '0.95rem', margin: 0 }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugat nulla pariatur.
              </p>
              <p style={{ color: 'var(--ink-mute)', lineHeight: 1.7, fontFamily: 'var(--font-body)', fontSize: '0.95rem', margin: 0, marginTop: '0.75rem' }}>
                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus nec porta.
              </p>
            </div>
            {/* Right column */}
            <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)', lineHeight: 1 }}>{entries.length}</div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-mute)' }}>foods logged</div>
              <hr style={{ width: '40px', border: 'none', borderTop: '1px solid var(--line)', margin: '0.25rem 0' }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink-mute)' }}>est. 2025</div>
            </div>
          </div>
        </Card>
      </SectionErrorBoundary>

    </div>
  )
}
