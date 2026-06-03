import { useState, useEffect, useRef } from 'react'

interface Props {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}

export default function RatingInput({ label, value, onChange }: Props) {
  const [displayStr, setDisplayStr] = useState<string>(value != null ? String(value) : '')
  const skipSyncRef = useRef(false)

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    setDisplayStr(value != null ? String(value) : '')
  }, [value])

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    skipSyncRef.current = true
    if (raw === '') {
      setDisplayStr('')
      onChange(null)
      return
    }
    const n = parseFloat(raw)
    if (!isNaN(n)) {
      if (n > 10) { setDisplayStr('10'); onChange(10); return }
      if (n < 0) { setDisplayStr('0'); onChange(0); return }
      onChange(n)
    }
    setDisplayStr(raw)
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = parseFloat(e.target.value)
    setDisplayStr(String(n))
    onChange(n)
  }

  const fill = ((value ?? 0) / 10 * 100).toFixed(2)

  return (
    <div>
      <label style={labelStyle}>
        {label} <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(0–10)</span>
      </label>
      <input
        type="number"
        min={0}
        max={10}
        step="any"
        placeholder="–"
        value={displayStr}
        onChange={handleNumberChange}
        style={numberInputStyle}
      />
      <input
        type="range"
        className="rating-slider"
        min={0}
        max={10}
        step={0.01}
        value={value ?? 0}
        onChange={handleSliderChange}
        style={{ '--slider-fill': `${fill}%` } as React.CSSProperties}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 500,
  fontSize: '0.85rem',
  marginBottom: '0.25rem',
  color: 'var(--ink)',
}

const numberInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  background: 'var(--paper)',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  boxSizing: 'border-box',
}
