import type { Metadata } from 'next'
import { getFestival } from '@/db/actions/festivals'
import FestivalDetailClient from './FestivalDetailClient'

// Cache the server-rendered page shell for 1 hour (ISR)
export const revalidate = 3600

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const decodedId = decodeURIComponent(id)

  // Only fetch metadata for DB-backed festivals (ra-, custom-)
  if (decodedId.startsWith('ra-') || decodedId.startsWith('custom-')) {
    const festival = await getFestival(decodedId)
    if (festival) {
      return {
        title: `${festival.name} – Goodraves`,
        description: `${festival.name}${festival.venue ? ` at ${festival.venue}` : ''}${festival.date ? ` on ${festival.date}` : ''} – view lineup, rate artists, and track your attendance.`,
        openGraph: {
          title: festival.name,
          description: `Festival details and lineup for ${festival.name}`,
          ...(festival.imageUrl ? { images: [festival.imageUrl] } : {}),
        },
      }
    }
  }

  return {
    title: 'Festival – Goodraves',
    description: 'View festival details, lineup, and track your attendance on Goodraves.',
  }
}

export default function FestivalDetailPage() {
  return <FestivalDetailClient />
}
