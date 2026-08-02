import type { Metadata } from 'next'
import { getArtistDataSnapshot } from '@/db/actions/artists'
import ArtistDetailClient from './ArtistDetailClient'

// Cache the server-rendered page shell for 1 hour (ISR)
export const revalidate = 3600

interface Props {
  params: Promise<{ id: string; name: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params
  const artistName = decodeURIComponent(name)
  return {
    title: `${artistName} – Goodraves`,
    description: `${artistName} – view bio, top tracks, releases, genres and similar artists on Goodraves.`,
    openGraph: {
      title: artistName,
      description: `Artist profile for ${artistName} on Goodraves`,
    },
  }
}

export default async function ArtistDetailPage({ params }: Props) {
  const { id } = await params

  // Server-fetch the cached DB snapshot (no external API calls) so the
  // initial HTML has real content instead of a loading skeleton (better
  // LCP/SEO). The client still refreshes stale data afterward.
  const initialArtist = await getArtistDataSnapshot(id)

  return <ArtistDetailClient initialArtist={initialArtist} />
}
