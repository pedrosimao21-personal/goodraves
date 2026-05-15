import type { Metadata } from 'next'
import { auth } from '@/../auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getExploreData, getExploreSuggestedTags } from '@/db/actions/explore'
import { getTrendingFestivals, type TrendingFestival } from '@/db/actions/trending-festivals'
import { EXPLORE_GENRE_OPTIONS } from '@/constants/explore-genres'
import ExplorePageClient from '@/components/ExplorePageClient'

interface Props {
  params: Promise<{ genre: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre } = await params
  const decodedGenre = decodeURIComponent(genre)
  const option = EXPLORE_GENRE_OPTIONS.find((o) => o.value === decodedGenre)
  const displayName = option?.label ?? decodedGenre

  return {
    title: `${displayName} – Explore Genres | Goodraves`,
    description: `Discover the top artists, tracks, and albums in ${displayName}. Explore the best music in the genre on Goodraves.`,
  }
}

async function fetchUserCity(): Promise<string | null> {
  try {
    const session = await auth()
    if (!session?.user?.id) return null

    const [row] = await db
      .select({ city: users.city })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    return row?.city ?? null
  } catch {
    return null
  }
}

async function fetchTrendingFestivals(userCity: string | null): Promise<{
  festivals: TrendingFestival[]
  userCity: string | null
}> {
  try {
    const festivals = await getTrendingFestivals(userCity, null, 6)
    return { festivals, userCity }
  } catch {
    return { festivals: [], userCity: null }
  }
}

export default async function ExploreGenrePage({ params }: Props) {
  const { genre } = await params
  const decodedGenre = decodeURIComponent(genre)

  const userCity = await fetchUserCity()

  const [initialData, suggestedTags, { festivals: trendingFestivals }] = await Promise.all([
    getExploreData(decodedGenre),
    getExploreSuggestedTags(),
    fetchTrendingFestivals(userCity),
  ])

  return (
    <ExplorePageClient
      initialData={initialData}
      suggestedTags={suggestedTags}
      genreOptions={EXPLORE_GENRE_OPTIONS}
      trendingFestivals={trendingFestivals}
      userCity={userCity}
      isAuthenticated={userCity !== null}
    />
  )
}
