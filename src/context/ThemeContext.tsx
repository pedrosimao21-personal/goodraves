'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
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
 * Prefers the `data-theme` attribute the no-flash inline script (see
 * layout.tsx) sets on <html> before hydration. Falls back to reading
 * localStorage/matchMedia directly (same logic as that script) in case the
 * attribute didn't survive hydration — React's reconciliation of the root
 * <html> element can drop attributes it doesn't itself manage, which would
 * otherwise desync this state from the actual persisted preference.
 */
function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  // Self-heal: re-apply the attribute after mount in case hydration cleared
  // the one the inline script set (see readInitialTheme above for why).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    syncThemeColorMeta(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
