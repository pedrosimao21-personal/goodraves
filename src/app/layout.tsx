import type { Metadata, Viewport } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import ErrorBoundary from '@/components/ErrorBoundary'
import Providers from '@/components/Providers'
import { UserDataProvider } from '@/context/UserDataContext'
import { getInitialUserData } from '@/db/actions/get-initial-data'
import { auth } from '../../auth'
import { Suspense } from 'react'

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
  // Rendered into a <meta name="theme-color"> tag read by the browser before
  // any CSS loads, so it can't reference a CSS custom property — keep this
  // in sync with --bg-primary in globals.css by hand.
  themeColor: '#0d0d14',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialData = await getInitialUserData()
  const session = await auth()

  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>
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
      </body>
    </html>
  )
}
