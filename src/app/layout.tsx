import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import ErrorBoundary from '@/components/ErrorBoundary'
import Providers from '@/components/Providers'
import { UserDataProvider } from '@/context/UserDataContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { THEME_STORAGE_KEY, THEME_COLORS } from '@/lib/theme-constants'
import { fetchUserDataForId } from '@/db/actions/user-data-query'
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

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Goodraves',
  description: 'Goodraves – discover raves & festivals, track what you attended, rate the DJs you saw.',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
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
  // auth() reads cookies, so it must run here anyway — derive the userId from
  // this one session and hand it straight to the query. Going through the
  // auth-gated wrapper instead would run auth() a second time, serially.
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const initialData = userId ? await fetchUserDataForId(userId) : null

  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <Providers session={session}>
            <UserDataProvider initialData={initialData}>
              <Navbar />
              <ErrorBoundary>
                <Suspense fallback={null}>
                  {children}
                </Suspense>
              </ErrorBoundary>
            </UserDataProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
