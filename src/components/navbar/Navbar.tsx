'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useUserData } from '@/context/UserDataContext'
import { RefreshIcon } from '@/components/icons'
import BrandMark from '@/components/BrandMark'
import AccountMenu from './AccountMenu'
import { NAV_ITEMS, isNavItemActive } from './nav-items'
import styles from './Navbar.module.css'

const TAB_ICON_SIZE = 22

export default function Navbar() {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const { data: session, status } = useSession()
  const { isAdmin } = useUserData()

  return (
    <>
      <header className={styles.bar}>
        <div className={styles.inner}>
          <Link href="/" className={styles.logo}>
            <BrandMark className={styles.logoMark} />
            <span className={styles.logoWord}>Goodraves</span>
          </Link>

          <nav className={styles.links} aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const isActive = isNavItemActive(item, pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => window.location.reload()}
              aria-label="Reload app"
            >
              <RefreshIcon />
            </button>
            {status === 'authenticated' && session?.user ? (
              <AccountMenu username={session.user.name ?? ''} avatarUrl={session.user.image ?? null} isAdmin={isAdmin} />
            ) : status === 'unauthenticated' ? (
              <>
                <Link href="/login" className="btn btn-sm btn-ghost" aria-current={pathname === '/login' ? 'page' : undefined}>Log in</Link>
                {/* The auth pages have their own primary button; keep this one quiet there. */}
                <Link
                  href="/register"
                  className={`btn btn-sm ${isAuthPage ? 'btn-ghost' : 'btn-primary'}`}
                  aria-current={pathname === '/register' ? 'page' : undefined}
                >
                  Register
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <nav className={styles.tabBar} aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(item, pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={TAB_ICON_SIZE} />
              {item.shortLabel}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
