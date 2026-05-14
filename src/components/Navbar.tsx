'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'

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
const ExploreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
  </svg>
)
const ChartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const NAV_ITEMS = [
  { to: '/', label: 'Discover', icon: <DiscoverIcon />, end: true },
  { to: '/explore', label: 'Explore', icon: <ExploreIcon />, end: false },
  { to: '/dashboard', label: 'My Festivals', icon: <MyFestivalsIcon />, end: false },
  { to: '/timeline', label: 'Timeline', icon: <TimelineIcon />, end: false },
  { to: '/top-djs', label: 'Top DJs', icon: <TopDjsIcon />, end: false },
]

export default function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownRef])

  const isActive = (to: string, end?: boolean) => {
    if (end) return pathname === to
    return pathname === to || pathname.startsWith(to + '/')
  }

  return (
    <>
      {/* ── Top bar (always visible) ── */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="navbar-logo">
            <LogoIcon />
            Goodraves
          </Link>
          {/* Desktop links — hidden on mobile via CSS */}
          <div className="navbar-nav navbar-nav-desktop">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.to}
                href={item.to}
                className={isActive(item.to, item.end) ? 'active' : ''}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {status === 'authenticated' && session?.user ? (
              <div className="navbar-profile" ref={dropdownRef} style={{ position: 'relative' }}>
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)} 
                  style={{ 
                    background: 'var(--gradient-card)', 
                    border: '1px solid var(--border)', 
                    width: 36, 
                    height: 36, 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: '1rem'
                  }}
                >
                  {session.user.name?.[0]?.toUpperCase() || 'U'}
                </button>
                {dropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    width: 175,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 100
                  }}>
                    <Link 
                      href="/profile" 
                      onClick={() => setDropdownOpen(false)}
                      style={{ padding: '12px 16px', color: 'inherit', textDecoration: 'none', fontSize: '0.9rem', borderBottom: '1px solid var(--border)' }}
                    >
                      Go to Profile
                    </Link>
                    <Link 
                      href="/insights" 
                      onClick={() => setDropdownOpen(false)}
                      style={{ padding: '12px 16px', color: 'inherit', textDecoration: 'none', fontSize: '0.9rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <ChartIcon /> Your Insights
                    </Link>
                    <button 
                      onClick={() => { setDropdownOpen(false); signOut({ callbackUrl: '/' }) }}
                      style={{ padding: '12px 16px', background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : status === 'unauthenticated' ? (
              <>
                <Link href="/login" className="navbar-auth-btn">Log in</Link>
                <Link href="/register" className="navbar-auth-btn navbar-auth-btn-primary">Register</Link>
              </>
            ) : null}
            {/* Reload button — only visible when launched as a PWA (no browser chrome) */}
            <button
              className="pwa-reload-btn"
              onClick={() => window.location.reload()}
              title="Reload app"
              aria-label="Reload"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Bottom tab bar (mobile only) ── */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.to}
            href={item.to}
            className={`bottom-nav-item${isActive(item.to, item.end) ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
