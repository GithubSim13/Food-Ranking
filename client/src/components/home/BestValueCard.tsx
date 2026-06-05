import { useNavigate } from 'react-router-dom'
import SectionErrorBoundary from '../common/SectionErrorBoundary'
import { scoreColor } from '../../utils'
import { Card } from './HomeShared'

type ValueItem = { name: string; valueScore: number }
type BestValueRest = { name: string; total: number; avgValue: number } | null

type Props = {
  bestValueRest: BestValueRest
  bestValueItems: ValueItem[]
}

export default function BestValueCard({ bestValueRest, bestValueItems }: Props) {
  const navigate = useNavigate()

  return (
    <SectionErrorBoundary title="Best Value Spot">
    <Card onClick={() => navigate('/restaurants')} style={{ display: 'flex', gap: '1.25rem', overflow: 'hidden' }}>
      {/* Left: summary */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-mute)', marginBottom: '0.4rem' }}>★ Best Value Spot</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--gold)', lineHeight: 1, marginBottom: '0.35rem' }}>
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
    </SectionErrorBoundary>
  )
}
