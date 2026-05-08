import type { Metadata } from 'next'
import ArtistDetailClient from './ArtistDetailClient'

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

export default function ArtistDetailPage() {
  return <ArtistDetailClient />
}
