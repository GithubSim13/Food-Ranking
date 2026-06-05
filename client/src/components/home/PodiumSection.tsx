import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import FlagImage from '../common/FlagImage'
import SectionErrorBoundary from '../common/SectionErrorBoundary'
import { scoreColor } from '../../utils'
import { Card, type Top5Entry } from './HomeShared'

const PODIUM_CONTAINER_H = 320
const PODIUM_TOP_PAD = 16

export default function PodiumSection({ top5, shameList }: { top5: Top5Entry[]; shameList: Top5Entry[] }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [shameExpanded, setShameExpanded] = useState(false)
  const podiumCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = podiumCardRef.current
    if (!el) return
    const scrollContainer = el.closest('main') as HTMLElement | null
    if (!scrollContainer) return

    const handleScroll = () => {
      const cardRect = el.getBoundingClientRect()
      const containerRect = scrollContainer.getBoundingClientRect()
      const cardMid = cardRect.top + cardRect.height / 2
      const containerMid = containerRect.top + containerRect.height / 2
      setShameExpanded(cardMid < containerMid)
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  const [p1, p2, p3, p4, p5] = top5
  const [s1, s2, s3, s4, s5] = shameList

  const podiumOrder = (p1 && p2 && p3) ? [
    p4 ? { entry: p4, rank: 4, height: Math.round(PODIUM_CONTAINER_H * 0.28), barColor: '#170840', scoreOpacity: 0.35 } : null,
    { entry: p2, rank: 2, height: Math.round(PODIUM_CONTAINER_H * 0.50), barColor: '#5135a0', scoreOpacity: 0.55 },
    { entry: p1, rank: 1, height: Math.round(PODIUM_CONTAINER_H * 0.65), barColor: '#7956dc', scoreOpacity: 1 },
    { entry: p3, rank: 3, height: Math.round(PODIUM_CONTAINER_H * 0.40), barColor: '#2a1660', scoreOpacity: 0.35 },
    p5 ? { entry: p5, rank: 5, height: Math.round(PODIUM_CONTAINER_H * 0.18), barColor: '#08021b', scoreOpacity: 0.35 } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null) : []

  const shamePodiumOrder = (s1 && s2 && s3) ? [
    s4 ? { entry: s4, rank: 4, depth: Math.round(PODIUM_CONTAINER_H * 0.28), barColor: '#522204', scoreOpacity: 0.35 } : null,
    { entry: s2, rank: 2, depth: Math.round(PODIUM_CONTAINER_H * 0.50), barColor: '#9d4813', scoreOpacity: 0.55 },
    { entry: s1, rank: 1, depth: Math.round(PODIUM_CONTAINER_H * 0.65), barColor: '#d46c2c', scoreOpacity: 1 },
    { entry: s3, rank: 3, depth: Math.round(PODIUM_CONTAINER_H * 0.40), barColor: '#6d2e07', scoreOpacity: 0.35 },
    s5 ? { entry: s5, rank: 5, depth: Math.round(PODIUM_CONTAINER_H * 0.18), barColor: '#3b1701', scoreOpacity: 0.35 } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null) : []

  return (
    <SectionErrorBoundary title="Hall of Fame / Hall of Shame">
    <div ref={podiumCardRef}>
    <Card style={{ marginBottom: '1.5rem' }}>

      {/* All Rankings link — top right, out of the way */}
      <div style={{ textAlign: 'right', marginBottom: '0.25rem' }}>
        <span onClick={() => navigate('/rankings')} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#6c47d4', cursor: 'pointer' }}>All Rankings →</span>
      </div>

      {/* ── Hall of Fame — collapses when shame expands ── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: shameExpanded ? '0fr' : '1fr',
        overflow: 'hidden',
        transition: 'grid-template-rows 450ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
      <div style={{ position: 'relative', height: PODIUM_CONTAINER_H + PODIUM_TOP_PAD }}>
        {/* Ghost: Hall of Fame watermark — letter-staggered */}
        <div className="hall-title-fame" style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '11rem',
          color: 'var(--ink)',
          textAlign: 'center', pointerEvents: 'none', userSelect: 'none',
          lineHeight: 1.1, letterSpacing: '-0.04em', zIndex: 0,
          marginTop: '0.9rem',
        }}>
          {'Hall of Fame'.split('').map((char, i) => {
            const total = 'Hall of Fame'.length
            const delay = shameExpanded ? (total - 1 - i) * 20 : 150 + i * 60
            return (
              <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: shameExpanded ? 0 : 0.13, transform: shameExpanded ? 'translateY(-15px)' : 'translateY(0)', transition: `opacity 500ms cubic-bezier(0.34, 1.1, 0.64, 1) ${delay}ms, transform 500ms cubic-bezier(0.34, 1.1, 0.64, 1) ${delay}ms` }}>{char}</span>
            )
          })}
        </div>

        {/* Fame columns — pinned to bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: '0.75rem', zIndex: 1 }}>
          {podiumOrder.map(({ entry: fEntry, rank: fRank, height: fHeight, barColor: fColor, scoreOpacity: fOpacity }, barIndex) => {
            const barDelay = !shameExpanded ? barIndex * 80 : (4 - barIndex) * 80 + 150
            const contentDelay = !shameExpanded ? barIndex * 80 + 200 : (4 - barIndex) * 80
            const barTr = `transform 800ms cubic-bezier(0.34, 1.2, 0.64, 1) ${barDelay}ms`
            const contentTr = `opacity ${!shameExpanded ? 600 : 300}ms cubic-bezier(0.4, 0, 0.2, 1) ${contentDelay}ms, transform ${!shameExpanded ? 600 : 300}ms cubic-bezier(0.4, 0, 0.2, 1) ${contentDelay}ms`
            return (
              <div key={fEntry.id} style={{ flex: 1, minWidth: 0 }}>
                <div
                  onClick={() => navigate(`/entries/${fEntry.id}`, { state: { background: location } })}
                  style={{ height: PODIUM_CONTAINER_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer' }}
                >
                  <div style={{ textAlign: 'center', marginBottom: '0.5rem', padding: '0 0.25rem', width: '100%', opacity: shameExpanded ? 0 : 1, transform: shameExpanded ? 'translateY(12px)' : 'translateY(0)', transition: contentTr }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: fRank <= 3 ? '0.85rem' : '0.75rem', fontWeight: 600, color: fRank <= 3 ? 'var(--ink)' : 'var(--ink-mute)' }}>
                      {fEntry.flag && <div style={{ marginBottom: '0.25rem' }}><FlagImage code={fEntry.flag} /></div>}
                      <span style={{ fontSize: '1rem', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center' }}>{fEntry.name}</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: fHeight, background: `linear-gradient(to bottom, ${fColor}, transparent)`, borderRadius: '6px 6px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden', padding: '0.5rem 0.25rem', transform: shameExpanded ? 'scaleY(0)' : 'scaleY(1)', transformOrigin: 'bottom', transition: barTr }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: fRank === 1 ? '2.2rem' : fRank === 2 ? '1.7rem' : fRank === 3 ? '1.35rem' : fRank === 4 ? '1.05rem' : '0.9rem', color: scoreColor(fEntry.score), lineHeight: 1, opacity: shameExpanded ? 0 : 1, transform: shameExpanded ? 'translateY(12px)' : 'translateY(0)', transition: contentTr }}>{fEntry.score.toFixed(2)}</span>
                    {fRank <= 3 && <>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: `rgba(255,255,255,${fOpacity * 0.65})`, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', opacity: shameExpanded ? 0 : 1, transform: shameExpanded ? 'translateY(12px)' : 'translateY(0)', transition: contentTr }}>{fEntry.category}</span>
                      <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '10px', color: `rgba(255,255,255,${fOpacity * 0.8})`, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', opacity: shameExpanded ? 0 : 1, transform: shameExpanded ? 'translateY(12px)' : 'translateY(0)', transition: contentTr }}>{fEntry.restaurant}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: `rgba(255,255,255,${fOpacity * 0.55})`, textAlign: 'center', lineHeight: 1.3, opacity: shameExpanded ? 0 : 1, transform: shameExpanded ? 'translateY(12px)' : 'translateY(0)', transition: contentTr }}>{fEntry.reviewCount} {fEntry.reviewCount === 1 ? 'review' : 'reviews'}</span>
                      {fEntry.quote && <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.68rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.3, marginTop: '6px', padding: '0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', opacity: shameExpanded ? 0 : 1, transform: shameExpanded ? 'translateY(12px)' : 'translateY(0)', transition: contentTr }}>"{fEntry.quote}"</span>}
                    </>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </div>
      </div>

      {/* Divider — fame/shame junction */}
      <div style={{ height: 0.1, background: 'rgba(255, 255, 255, 0)', position: 'relative', zIndex: 2 }} />

      {/* ── Hall of Shame — expands as user scrolls down ── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: shameExpanded ? '1fr' : '0fr',
        overflow: 'hidden',
        transition: 'grid-template-rows 450ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
          {shamePodiumOrder.map(({ entry: sEntry, rank: sRank, depth: sDepth, barColor: sColor, scoreOpacity: sOpacity }, barIndex) => {
            const barDelay = shameExpanded ? barIndex * 80 : (4 - barIndex) * 80 + 150
            const contentDelay = shameExpanded ? barIndex * 80 + 200 : (4 - barIndex) * 80
            const barTr = `transform 800ms cubic-bezier(0.34, 1.2, 0.64, 1) ${barDelay}ms`
            const contentTr = `opacity ${shameExpanded ? 600 : 300}ms cubic-bezier(0.4, 0, 0.2, 1) ${contentDelay}ms, transform ${shameExpanded ? 600 : 300}ms cubic-bezier(0.4, 0, 0.2, 1) ${contentDelay}ms`
            return (
              <div key={sEntry.id} style={{ flex: 1, minWidth: 0 }}>
                <div
                  onClick={() => navigate(`/entries/${sEntry.id}`, { state: { background: location } })}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ width: '100%', height: sDepth, background: `linear-gradient(to top, ${sColor}, transparent)`, borderRadius: '0 0 6px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden', padding: '0.5rem 0.25rem', transform: shameExpanded ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: 'top', transition: barTr }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: sRank === 1 ? '2.2rem' : sRank === 2 ? '1.7rem' : sRank === 3 ? '1.35rem' : sRank === 4 ? '1.05rem' : '0.9rem', color: scoreColor(sEntry.score), lineHeight: 1, opacity: shameExpanded ? 1 : 0, transform: shameExpanded ? 'translateY(0)' : 'translateY(12px)', transition: contentTr }}>{sEntry.score.toFixed(2)}</span>
                    {sRank <= 3 && <>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: `rgba(255,255,255,${sOpacity * 0.65})`, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', opacity: shameExpanded ? 1 : 0, transform: shameExpanded ? 'translateY(0)' : 'translateY(12px)', transition: contentTr }}>{sEntry.category}</span>
                      <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '10px', color: `rgba(255,255,255,${sOpacity * 0.8})`, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', opacity: shameExpanded ? 1 : 0, transform: shameExpanded ? 'translateY(0)' : 'translateY(12px)', transition: contentTr }}>{sEntry.restaurant}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: `rgba(255,255,255,${sOpacity * 0.55})`, textAlign: 'center', lineHeight: 1.3, opacity: shameExpanded ? 1 : 0, transform: shameExpanded ? 'translateY(0)' : 'translateY(12px)', transition: contentTr }}>{sEntry.reviewCount} {sEntry.reviewCount === 1 ? 'review' : 'reviews'}</span>
                      {sEntry.quote && <span style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '0.68rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.3, marginTop: '6px', padding: '0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', opacity: shameExpanded ? 1 : 0, transform: shameExpanded ? 'translateY(0)' : 'translateY(12px)', transition: contentTr }}>"{sEntry.quote}"</span>}
                    </>}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '0.5rem', padding: '0 0.25rem', width: '100%', opacity: shameExpanded ? 1 : 0, transform: shameExpanded ? 'translateY(0)' : 'translateY(12px)', transition: contentTr }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: sRank <= 3 ? '0.85rem' : '0.75rem', fontWeight: 600, color: sRank <= 3 ? 'var(--ink)' : 'var(--ink-mute)' }}>
                      {sEntry.flag && <div style={{ marginBottom: '0.25rem' }}><FlagImage code={sEntry.flag} /></div>}
                      <span style={{ fontSize: '1rem', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center' }}>{sEntry.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Ghost: Hall of Shame watermark — letter-staggered */}
        <div className="hall-title-shame" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '11rem', color: 'var(--ink)', textAlign: 'center', pointerEvents: 'none', userSelect: 'none', lineHeight: 1.1, letterSpacing: '-0.04em', marginTop: '-7.35rem' }}>
          {'Hall of Shame'.split('').map((char, i) => {
            const total = 'Hall of Shame'.length
            const delay = shameExpanded ? 150 + i * 60 : (total - 1 - i) * 20
            return (
              <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: shameExpanded ? 0.13 : 0, transform: shameExpanded ? 'translateY(0)' : 'translateY(20px)', transition: `opacity 500ms cubic-bezier(0.34, 1.1, 0.64, 1) ${delay}ms, transform 500ms cubic-bezier(0.34, 1.1, 0.64, 1) ${delay}ms` }}>{char}</span>
            )
          })}
        </div>
      </div>
      </div>

    </Card>
    </div>
    </SectionErrorBoundary>
  )
}
