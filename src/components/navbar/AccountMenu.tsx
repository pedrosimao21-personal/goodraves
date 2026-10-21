'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { THEME_PREFERENCES, type ThemePreference } from '@/lib/theme-constants'
import styles from './AccountMenu.module.css'

const ACCOUNT_PANEL_ID = 'account-menu'

const THEME_LABELS: Record<ThemePreference, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}

interface AccountMenuProps {
  username: string
  isAdmin: boolean
}

/** Avatar button that opens the account menu: profile, theme, admin, sign out. */
export default function AccountMenu({ username, isAdmin }: AccountMenuProps) {
  const { preference, setPreference } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const close = () => setIsOpen(false)
  const initial = username[0]?.toUpperCase() || 'U'

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.avatarButton}
        aria-label="Account menu"
        aria-expanded={isOpen}
        aria-controls={ACCOUNT_PANEL_ID}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.avatar}>{initial}</span>
      </button>

      {isOpen && (
        <>
          <div className={styles.scrim} onClick={close} aria-hidden="true" />
          <div id={ACCOUNT_PANEL_ID} className={styles.panel} role="dialog" aria-label="Account">
            <div className={styles.handle} aria-hidden="true"><span /></div>
            <div className={styles.header}>
              <p className={styles.name}>{username}</p>
            </div>
            <Link href="/profile" className={styles.item} onClick={close}>
              Profile and settings
            </Link>
            <div className={styles.themeRow}>
              <span className={`mono ${styles.themeLabel}`}>Theme</span>
              <div className={styles.segment} role="group" aria-label="Theme">
                {THEME_PREFERENCES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={styles.segmentButton}
                    aria-pressed={preference === option}
                    onClick={() => setPreference(option)}
                  >
                    {THEME_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
            {isAdmin && (
              <Link href="/admin" className={styles.item} onClick={close}>
                Admin
              </Link>
            )}
            <button
              type="button"
              className={`${styles.item} ${styles.itemMuted}`}
              onClick={() => { close(); signOut({ callbackUrl: '/' }) }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
