import type { Metadata, Viewport } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import ErrorBoundary from '@/components/ErrorBoundary'
import Providers from '@/components/Providers'
import { UserDataProvider } from '@/context/UserDataContext'
import { getInitialUserData } from '@/db/actions/get-initial-data'
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
  themeColor: '#0d0d14',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialData = await getInitialUserData()

  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <Providers>
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
