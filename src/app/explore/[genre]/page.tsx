import type { Metadata } from 'next'
import { getExploreData, getExploreSuggestedTags } from '@/db/actions/explore'
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

export default async function ExploreGenrePage({ params }: Props) {
  const { genre } = await params
  const decodedGenre = decodeURIComponent(genre)

  const [initialData, suggestedTags] = await Promise.all([
    getExploreData(decodedGenre),
    getExploreSuggestedTags(),
  ])

  return (
    <ExplorePageClient
      initialData={initialData}
      suggestedTags={suggestedTags}
      genreOptions={EXPLORE_GENRE_OPTIONS}
    />
  )
}
