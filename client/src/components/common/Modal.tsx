import { useEffect, useRef, type ReactNode } from 'react'

export default function Modal({ onClose, children, maxWidth = 800 }: { onClose: () => void; children: ReactNode; maxWidth?: number }) {
  const backdropMouseDown = useRef(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) backdropMouseDown.current = true
      }}
      onMouseUp={(e) => {
        if (e.target === e.currentTarget && backdropMouseDown.current) onClose()
        backdropMouseDown.current = false
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
        }}
      >
        {children}
      </div>
    </div>
  )
}
