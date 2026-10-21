import { Suspense } from 'react'
import SearchSection from '@/components/discover/SearchSection'

export default function Home() {
  return (
    <div className="page">
      <div className="container">
        <Suspense fallback={null}>
          <SearchSection />
        </Suspense>
      </div>
    </div>
  )
}
