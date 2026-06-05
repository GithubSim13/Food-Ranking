import { useNavigate, useLocation } from 'react-router-dom'
import FlagImage from '../common/FlagImage'
import SectionErrorBoundary from '../common/SectionErrorBoundary'
import type { EntryDetail } from '../../types'

type Props = {
  champEntry: EntryDetail | null
  champScore: number | null
  champReviewCount: number
  champNote: string
  champTaste: number | null
  champValue: number | null
  champConsistency: number | null
}

export default function ReigningChampionCard({ champEntry, champScore, champReviewCount, champNote, champTaste, champValue, champConsistency }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <SectionErrorBoundary title="Reigning Champion">
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
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
        tried {champReviewCount} {champReviewCount === 1 ? 'time' : 'times'}
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
    </SectionErrorBoundary>
  )
}
