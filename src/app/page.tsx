import { Suspense } from 'react'
import SearchSection from '@/components/SearchSection'
import { auth } from '@/../auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUpcomingFestivals, type UpcomingFestival } from '@/db/actions/homepage-festivals'
import UpcomingFestivalsSection from '@/components/UpcomingFestivalsSection'

async function fetchUpcomingFestivals(): Promise<{
  festivals: UpcomingFestival[]
  userCity: string | null
}> {
  try {
    const session = await auth()
    let userCity: string | null = null

    if (session?.user?.id) {
      const [row] = await db
        .select({ city: users.city })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1)
      userCity = row?.city ?? null
    }

    const festivals = await getUpcomingFestivals(userCity, null, 6)
    return { festivals, userCity }
  } catch {
    return { festivals: [], userCity: null }
  }
}

export default async function Home() {
  const { festivals, userCity } = await fetchUpcomingFestivals()

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

        {festivals.length > 0 && (
          <UpcomingFestivalsSection festivals={festivals} userCity={userCity} />
        )}
      </div>
    </div>
  )
}
