'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { type Theme, type ThemePreference, THEME_STORAGE_KEY, THEME_COLORS } from '@/lib/theme-constants'

const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)'

function syncThemeColorMeta(theme: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

interface ThemeContextType {
  /** The theme in effect right now. */
  theme: Theme
  /** What the user chose: dark, light, or follow the system. */
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

function systemTheme(): Theme {
  return window.matchMedia(LIGHT_SCHEME_QUERY).matches ? 'light' : 'dark'
}

function readInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/**
 * Prefers the `data-theme` attribute the no-flash inline script (see
 * layout.tsx) sets on <html> before hydration, and falls back to the same
 * logic as that script in case React's reconciliation of <html> dropped the
 * attribute.
 */
function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  const preference = readInitialPreference()
  return preference === 'system' ? systemTheme() : preference
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readInitialPreference)
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  // Re-apply the attribute after mount in case hydration cleared the one the
  // inline script set.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    syncThemeColorMeta(theme)
  }, [theme])

  // While following the system, track OS-level theme switches live.
  useEffect(() => {
    if (preference !== 'system') return
    const media = window.matchMedia(LIGHT_SCHEME_QUERY)
    const onChange = () => setTheme(systemTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    if (next === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY)
      setTheme(systemTheme())
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, next)
      setTheme(next)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}
