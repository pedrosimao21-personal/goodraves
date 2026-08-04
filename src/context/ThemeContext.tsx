'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { type Theme, THEME_STORAGE_KEY, THEME_COLORS } from '@/lib/theme-constants'

function syncThemeColorMeta(theme: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/**
 * Mirrors the `data-theme` attribute the no-flash inline script (see
 * layout.tsx) already set on <html> before hydration. Reading it here
 * (rather than localStorage/matchMedia again) keeps this the single source
 * of truth and avoids a hydration mismatch on the very first render, since
 * that script always runs first regardless of render timing.
 */
function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem(THEME_STORAGE_KEY, next)
      syncThemeColorMeta(next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
