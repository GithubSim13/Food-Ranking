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
      background: isSuccess ? '#dcfce7' : '#fee2e2',
      border: `1px solid ${isSuccess ? '#86efac' : '#fca5a5'}`,
      color: isSuccess ? '#166534' : '#991b1b',
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
