/**
 * Shared between the server-rendered layout (the no-flash inline script)
 * and the client ThemeContext — deliberately NOT in a `'use client'` file.
 * Importing a value from a client-directive module into a Server Component
 * turns it into a client-reference proxy rather than the real value, which
 * silently breaks string interpolation on the server.
 */

export type Theme = 'dark' | 'light'

/** What the user picked. 'system' follows prefers-color-scheme. */
export type ThemePreference = Theme | 'system'

export const THEME_PREFERENCES: ThemePreference[] = ['dark', 'light', 'system']

export const THEME_STORAGE_KEY = 'goodraves-theme'

// Mirrors --gr-bg for each theme in globals.css — kept here too since
// the <meta name="theme-color"> tag can't reference a CSS custom property.
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#0b0b0c',
  light: '#f4f2ec',
}
