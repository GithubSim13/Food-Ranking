import { useState, useRef, useEffect, useId } from 'react'
import * as Flags from 'country-flag-icons/react/3x2'
import { COUNTRIES } from './countryList'

interface Props {
  value: string | null
  onChange: (code: string | null) => void
}

type FlagComponents = Record<string, ((props: React.SVGProps<SVGSVGElement>) => React.JSX.Element) | undefined>

function FlagSvg({ code }: { code: string }) {
  const Flag = (Flags as FlagComponents)[code]
  if (!Flag) return null
  return <Flag style={{ width: '1.4em', height: 'auto', borderRadius: 2, flexShrink: 0 }} />
}

function getCountryName(code: string | null): string {
  if (!code) return ''
  return COUNTRIES.find(c => c.code === code)?.name ?? code
}

export default function FlagPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Sync displayed text when value changes externally
  useEffect(() => {
    if (!isOpen) setQuery(getCountryName(value))
  }, [value, isOpen])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery(getCountryName(value))
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value])

  const filtered = query.trim().length === 0
    ? COUNTRIES
    : COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.code.toLowerCase() === query.toLowerCase()
      )

  function open() {
    setQuery('')
    setIsOpen(true)
    setActiveIndex(-1)
  }

  function select(code: string | null) {
    onChange(code)
    setIsOpen(false)
    setQuery(getCountryName(code))
    setActiveIndex(-1)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') { open(); e.preventDefault() }
      return
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery(getCountryName(value))
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setActiveIndex(i => Math.max(i - 1, -1))
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (activeIndex === -1) {
        if (filtered.length > 0) select(filtered[0].code)
      } else if (filtered[activeIndex]) {
        select(filtered[activeIndex].code)
      }
      e.preventDefault()
    }
  }

  const inputDisplayValue = isOpen ? query : (value ? getCountryName(value) : '')

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {/* Flag preview when a value is selected and not typing */}
        {value && !isOpen && (
          <span style={{ position: 'absolute', left: '0.55rem', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            <FlagSvg code={value} />
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputDisplayValue}
          placeholder="No flag (local)"
          onFocus={open}
          onChange={e => {
            setQuery(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listId}
          style={{
            width: '100%',
            padding: '0.45rem 2.25rem 0.45rem',
            paddingLeft: value && !isOpen ? '2.25rem' : '0.65rem',
            background: 'var(--paper)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            boxSizing: 'border-box',
            fontSize: '0.9rem',
          }}
        />
        {/* Clear button */}
        {value && (
          <button
            type="button"
            tabIndex={-1}
            onClick={e => { e.stopPropagation(); select(null) }}
            title="Clear flag"
            style={{
              position: 'absolute',
              right: '0.45rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-mute)',
              fontSize: '0.85rem',
              padding: '0.1rem 0.25rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 200,
            maxHeight: 228,
            overflowY: 'auto',
            padding: 0,
            margin: 0,
            listStyle: 'none',
          }}
        >
          {/* Clear / no-flag option always at top */}
          <li
            role="option"
            aria-selected={value === null}
            onMouseDown={e => { e.preventDefault(); select(null) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--ink-mute)',
              borderBottom: '1px solid var(--line)',
              background: value === null ? 'var(--accent-wash)' : 'transparent',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--paper-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = value === null ? 'var(--accent-wash)' : 'transparent' }}
          >
            <span style={{ width: '1.4em', textAlign: 'center', fontSize: '0.75rem' }}>✕</span>
            No flag (local)
          </li>

          {filtered.length === 0 ? (
            <li style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem', color: 'var(--ink-mute)' }}>
              No countries match
            </li>
          ) : (
            filtered.map((country, idx) => (
              <li
                key={country.code}
                role="option"
                aria-selected={value === country.code}
                onMouseDown={e => { e.preventDefault(); select(country.code) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.45rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  background: idx === activeIndex ? 'var(--paper-2)' : value === country.code ? 'var(--accent-wash)' : 'transparent',
                }}
                onMouseEnter={e => {
                  setActiveIndex(idx)
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--paper-2)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background = idx === activeIndex ? 'var(--paper-2)' : value === country.code ? 'var(--accent-wash)' : 'transparent'
                }}
              >
                <FlagSvg code={country.code} />
                <span style={{ flex: 1 }}>{country.name}</span>
                <span style={{ color: 'var(--ink-mute)', fontSize: '0.75rem' }}>{country.code}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
