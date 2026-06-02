import * as Flags from 'country-flag-icons/react/3x2'

interface Props {
  code: string | null | undefined
  style?: React.CSSProperties
}

export default function FlagImage({ code, style }: Props) {
  if (!code) return null

  const Flag = (Flags as Record<string, ((props: React.SVGProps<SVGSVGElement>) => React.JSX.Element) | undefined>)[code]

  if (!Flag) {
    // Unknown code — render as text fallback
    return <span style={{ fontSize: '1em' }}>{code}</span>
  }

  return (
    <Flag
      style={{
        width: '1.25em',
        height: 'auto',
        verticalAlign: 'middle',
        borderRadius: 2,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
