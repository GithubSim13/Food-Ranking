import { scoreColor } from '../../utils'

export type Top5Entry = {
  id: number
  name: string
  flag: string | null
  score: number
  starred: boolean
  category: string
  restaurant: string
  reviewCount: number
  quote: string
}

export function firstNoteLine(notes: string | null | undefined): string {
  if (!notes) return ''
  return notes.split('\n')[0].trim()
}

export function Card({ children, style, onClick, className }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void; className?: string }) {
  return (
    <div onClick={onClick} className={className} style={{
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

export function SectionLabel({ children }: { children: React.ReactNode }) {
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

export function RankRow({ rank, name, visits, avg, onClick }: { rank: number; name: string; visits: number; avg: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--paper)', cursor: onClick ? 'pointer' : undefined }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', width: 14, flexShrink: 0 }}>{rank}</span>
      <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{name}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-mute)', flexShrink: 0 }}>{visits}×</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: scoreColor(avg), flexShrink: 0 }}>{avg.toFixed(1)}</span>
    </div>
  )
}
