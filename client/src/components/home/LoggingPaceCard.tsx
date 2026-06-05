import SectionErrorBoundary from '../common/SectionErrorBoundary'
import { Card, SectionLabel } from './HomeShared'

type ChartBar = { key: string; label: string; count: number }

type Props = {
  chartData: ChartBar[]
  chartMax: number
  chartPeakIdx: number
  avgPerMonth: number
  peakMonthLabel: string
  peakMonthCount: number
  loggingStreak: number
}

export default function LoggingPaceCard({ chartData, chartMax, chartPeakIdx, avgPerMonth, peakMonthLabel, peakMonthCount, loggingStreak }: Props) {
  return (
    <SectionErrorBoundary title="Logging Pace">
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
    </SectionErrorBoundary>
  )
}
