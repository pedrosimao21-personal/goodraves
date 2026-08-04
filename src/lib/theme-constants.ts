/**
 * Shared between the server-rendered layout (the no-flash inline script)
 * and the client ThemeContext — deliberately NOT in a `'use client'` file.
 * Importing a value from a client-directive module into a Server Component
 * turns it into a client-reference proxy rather than the real value, which
 * silently breaks string interpolation on the server.
 */

export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'goodraves-theme'

// Mirrors --bg-primary for each theme in globals.css — kept here too since
// the <meta name="theme-color"> tag can't reference a CSS custom property.
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#0d0d14',
  light: '#ffffff',
}
