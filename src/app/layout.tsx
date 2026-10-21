import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Archivo, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/navbar/Navbar'
import ErrorBoundary from '@/components/ErrorBoundary'
import Providers from '@/components/Providers'
import { UserDataProvider } from '@/context/UserDataContext'
import { FollowsProvider } from '@/context/FollowsContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { THEME_STORAGE_KEY, THEME_COLORS } from '@/lib/theme-constants'
import { auth } from '../../auth'
import { Suspense } from 'react'

// Runs before hydration so the correct theme (and matching browser-chrome
// color) is set on first paint — no flash of the wrong theme.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '${THEME_COLORS.light}' : '${THEME_COLORS.dark}');
  } catch (e) {}
})();
`

// Archivo is variable on weight and width: display type uses width 68%
// (font-stretch) for the condensed flyer look, body text stays at 100%.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  axes: ['wdth'],
  display: 'swap',
})

// Every date, set time, count and label is set in mono.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Goodraves',
  description: 'Goodraves – discover raves & festivals, track what you attended, rate the DJs you saw.',
  // The lime brand square on the dark ground; the PNGs are rendered from
  // icon.svg (iOS ignores SVG touch icons).
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Goodraves',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Static fallback for the pre-JS instant and non-JS clients; the inline
  // script below immediately corrects this to the active theme's color
  // (THEME_COLORS in lib/theme-constants.ts, kept in sync with --bg-primary
  // in globals.css by hand).
  themeColor: THEME_COLORS.dark,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // auth() reads cookies, needed for the session provider on every route
  // (including logged-out ones). Deliberately NOT also fetching the user's
  // full attendance/ratings data here anymore — that was a 7-query, fully
  // unbounded fetch that ran on every single route (including /login and
  // /register) and blocked the entire shell from rendering until it
  // finished. UserDataProvider's own client-side effect already fetches it
  // (the same path used for a mid-session sign-in), so logged-in users now
  // see one brief loading state on first load instead of every route
  // depending on this query's latency.
  const session = await auth()

  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <Providers session={session}>
            <UserDataProvider>
              <FollowsProvider>
                <Navbar />
                <ErrorBoundary>
                  <Suspense fallback={null}>
                    {children}
                  </Suspense>
                </ErrorBoundary>
              </FollowsProvider>
            </UserDataProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
