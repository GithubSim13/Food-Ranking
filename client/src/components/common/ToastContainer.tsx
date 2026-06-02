import { useContext } from 'react'
import { ToastContext } from '../../context/ToastContext'
import { Toast } from './Toast'

export function ToastContainer() {
  const { toasts, dismiss } = useContext(ToastContext)
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast message={t.message} variant={t.variant} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
