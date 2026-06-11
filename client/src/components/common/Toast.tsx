interface ToastProps {
  message: string
  variant: 'success' | 'error'
  onDismiss: () => void
}

export function Toast({ message, variant, onDismiss }: ToastProps) {
  const isSuccess = variant === 'success'
  return (
    <div style={{
      padding: '0.75rem 1rem',
      borderRadius: 8,
      background: isSuccess ? 'var(--toast-success-bg)' : 'var(--toast-error-bg)',
      border: `1px solid ${isSuccess ? 'var(--toast-success-border)' : 'var(--toast-error-border)'}`,
      color: isSuccess ? 'var(--toast-success-ink)' : 'var(--toast-error-ink)',
      fontSize: '0.875rem',
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      gap: '0.625rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      minWidth: 200,
      maxWidth: 360,
    }}>
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{isSuccess ? '✓' : '✕'}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 0.15rem',
          color: 'inherit',
          opacity: 0.5,
          fontSize: '1.1rem',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
