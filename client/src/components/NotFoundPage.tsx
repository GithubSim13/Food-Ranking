import { useNavigate } from 'react-router-dom'
import { kickerStyle, pageTitleStyle } from './common/pageStyles'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <p style={kickerStyle}>404</p>
      <h1 style={{ ...pageTitleStyle, marginBottom: '0.75rem' }}>Page not found</h1>
      <p style={{ fontSize: '0.95rem', color: 'var(--ink-mute)', marginBottom: '1.75rem' }}>
        That URL doesn't match any page in this app.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          border: 'none',
          padding: '0.55rem 1.25rem',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.9rem',
        }}
      >
        Go to Home
      </button>
    </div>
  )
}
