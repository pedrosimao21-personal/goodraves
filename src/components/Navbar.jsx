import { NavLink } from 'react-router-dom'

const LogoIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="15" stroke="url(#logoGrad)" strokeWidth="2" />
    <circle cx="16" cy="16" r="6" fill="url(#logoGrad)" opacity="0.9" />
    <circle cx="16" cy="16" r="10" stroke="url(#logoGrad)" strokeWidth="1.5" strokeDasharray="3 2" />
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
  </svg>
)

// Bottom nav icons
const DiscoverIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const MyFestivalsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
const TimelineIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const TopDjsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

const NAV_ITEMS = [
  { to: '/', label: 'Discover', icon: <DiscoverIcon />, end: true },
  { to: '/dashboard', label: 'My Festivals', icon: <MyFestivalsIcon /> },
  { to: '/timeline', label: 'Timeline', icon: <TimelineIcon /> },
  { to: '/top-djs', label: 'Top DJs', icon: <TopDjsIcon /> },
]

export default function Navbar() {
  return (
    <>
      {/* ── Top bar (always visible) ── */}
      <nav className="navbar">
        <div className="navbar-inner">
          <NavLink to="/" className="navbar-logo">
            <LogoIcon />
            Goodraves
          </NavLink>
          {/* Desktop links — hidden on mobile via CSS */}
          <div className="navbar-nav navbar-nav-desktop">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => isActive ? 'active' : ''}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Bottom tab bar (mobile only) ── */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
