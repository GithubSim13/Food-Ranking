import { Outlet, NavLink } from 'react-router-dom'

const linkStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'block',
  padding: '0.45rem 0.75rem',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: '0.95rem',
  fontWeight: isActive ? 600 : 400,
  color: isActive ? '#2563eb' : '#374151',
  background: isActive ? '#eff6ff' : 'transparent',
})

export default function AppShell() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <nav style={{
        width: 200,
        flexShrink: 0,
        padding: '1.5rem 1rem',
        borderRight: '1px solid #e5e7eb',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}>
        <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', color: '#111827' }}>
          Food Ranking
        </p>
        <NavLink to="/entries" style={({ isActive }) => linkStyle(isActive)}>
          Entries
        </NavLink>
        <NavLink to="/rankings" style={({ isActive }) => linkStyle(isActive)}>
          Rankings
        </NavLink>
      </nav>
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
