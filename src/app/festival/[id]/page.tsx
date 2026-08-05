import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getFestival, getFestivalMeta, getTimetable, getMergeRedirectTarget } from '@/db/actions/festivals'
import { getFestivalPlaylist } from '@/db/actions/festival-playlist'
import FestivalDetailClient from './FestivalDetailClient'

// Currently a no-op: the root layout calls auth(), which reads cookies, so every
// route is rendered dynamically and nothing is cached for this window. Kept so the
// intended 1-hour ISR window applies as soon as that cookie read moves out of the
// shared layout.
export const revalidate = 3600

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const decodedId = decodeURIComponent(id)

  // Cheap DB-only lookup for any cached festival (ra-, custom-, pf-, ff-, …)
  const festival = await getFestivalMeta(decodedId)
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

  return {
    title: 'Festival – Goodraves',
    description: 'View festival details, lineup, and track your attendance on Goodraves.',
  }
}

type ServerFestival = Awaited<ReturnType<typeof getFestival>>

/**
 * The playlist lookup needs the festival name, and falls back to a
 * "This is {headliner}" playlist — the headliner being the first lineup entry,
 * exactly as the client used to derive it from `attractions[0]`.
 */
async function fetchPlaylistForFestival(festival: ServerFestival) {
  if (!festival) return null
  return getFestivalPlaylist(festival.name, festival.lineup?.[0]?.name)
}

export default async function FestivalDetailPage({ params }: Props) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)

  // Custom ("custom-…") festivals aren't in the festivals table and rely on
  // client-side festivalMeta context, so they're left for the client fetch.
  if (decodedId.startsWith('custom-')) {
    return <FestivalDetailClient initialFestival={null} initialTimetable={null} initialPlaylist={null} />
  }

  // Server-fetch the public (non-user-specific) festival data so the initial
  // HTML has real content instead of a loading skeleton (better LCP/SEO). The
  // timetable and playlist were separate client-side round trips that started
  // only after hydration; neither is user-specific, so they belong here. The
  // timetable is independent of the festival read, so it runs in parallel.
  const festivalPromise = getFestival(decodedId)
  const [initialFestival, initialTimetable, initialPlaylist] = await Promise.all([
    festivalPromise,
    getTimetable(decodedId),
    festivalPromise.then(fetchPlaylistForFestival),
  ])

  // Not found locally and not auto-importable (parseFestivalSourceRef/
  // tryAutoImport in festival-data.ts already tried) — this id may be a merge
  // loser (see festival-merge.ts) whose data now lives on a winner row.
  // Redirect rather than 404 so old bookmarks/links keep working.
  if (!initialFestival) {
    const winnerId = await getMergeRedirectTarget(decodedId)
    if (winnerId) redirect(`/festival/${winnerId}`)
  }

  return (
    <FestivalDetailClient
      initialFestival={initialFestival}
      initialTimetable={initialTimetable}
      initialPlaylist={initialPlaylist}
    />
  )
}
