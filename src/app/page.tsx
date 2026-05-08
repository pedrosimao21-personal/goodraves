import { Suspense } from 'react'
import SearchSection from '@/components/SearchSection'

export default function Home() {
  return (
    <div className="page">
      <div className="hero">
        <div className="hero-badge">🎵 Goodraves</div>
        <h1>Discover &amp; Track Your Festivals</h1>
        <p>Search for music festivals and electronic events, mark which ones you attended, and keep track of every artist you&apos;ve seen.</p>
      </div>

      <div className="container">
        <Suspense fallback={<div className="skeleton skeleton-card" style={{ height: 200 }} />}>
          <SearchSection />
        </Suspense>
      </div>
    </div>
  )
}
