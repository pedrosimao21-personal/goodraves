'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUserData } from '@/context/UserDataContext'
import { getFestivalPhase } from '@/lib/festival-date'
import type { TimetableData } from '@/db/actions/festivals'
import type { FestivalPlaylistData } from '@/db/actions/festival-playlist'
import FestivalHeader from './FestivalHeader'
import LiveMode from './LiveMode'
import FestivalAdminMenu from './FestivalAdminMenu'
import FestivalYourNight from './FestivalYourNight'
import FestivalLineup from './FestivalLineup'
import FestivalPlaylist from './FestivalPlaylist'
import FestivalSkeleton from './FestivalSkeleton'
import { useFestivalData } from './use-festival-data'

type FestivalDetailProps = {
  initialFestival?: any
  /** Server-fetched timetable; null for custom festivals (fetched client-side). */
  initialTimetable?: TimetableData | null
  /** Server-fetched Spotify playlist; null when none was found, undefined when not looked up server-side. */
  initialPlaylist?: FestivalPlaylistData | null
}

export default function FestivalDetail({
  initialFestival = null,
  initialTimetable = null,
  initialPlaylist,
}: FestivalDetailProps) {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const router = useRouter()
  const { isAttended, isUpcoming, toggleFestival, getSeenCount, isAdmin } = useUserData()
  const { event, loading, error, spotifyData, playlist, timetable, refreshTimetable, reloadFestival } =
    useFestivalData(id, { initialFestival, initialTimetable, initialPlaylist })
  const [showAdminMenu, setShowAdminMenu] = useState(false)

  if (loading) return <FestivalSkeleton />
  if (error || !event) return null

  const isCustom = id.startsWith('custom-')
  const phase = getFestivalPhase(event.date, event.endDate)
  const attended = isAttended(id)
  const isGoing = attended || isUpcoming(id)
  const showLive = phase === 'ongoing' && isGoing && timetable.days.length > 0

  const handleToggleAttendance = async () => {
    const payload = { name: event.name, date: event.date, endDate: event.endDate, venue: event.venue, image: event.imageUrl, source: event.source }
    const finalId = await toggleFestival(id, payload)
    // upsertFestival reuses an existing row with the same name and date, so
    // the attendance can land on another id than the one in the URL. Follow
    // it, so the toggle and the vibe rating (also keyed by id) read that row.
    if (finalId && finalId !== id) {
      router.replace(`/festival/${finalId}`)
    }
  }

  return (
    <div className="page">
      <div className="container">
        {showLive && <LiveMode festivalId={id} timetable={timetable} />}
        <FestivalHeader
          id={id}
          event={event}
          phase={phase}
          isActive={isGoing}
          attended={attended}
          seenCount={getSeenCount(id)}
          onToggleAttendance={handleToggleAttendance}
          onRemoveAttendance={() => toggleFestival(id)}
          onOpenAdmin={isAdmin && !isCustom ? () => setShowAdminMenu(true) : undefined}
        />

        {attended && <FestivalYourNight eventId={id} />}

        <FestivalLineup id={id} event={event} timetable={timetable} spotifyData={spotifyData} phase={phase} />

        {playlist && <FestivalPlaylist playlist={playlist} festivalName={event.name} />}
      </div>

      {showAdminMenu && (
        <FestivalAdminMenu
          festivalId={id}
          festivalName={event.name}
          onClose={() => setShowAdminMenu(false)}
          onTimetableChanged={refreshTimetable}
          onFestivalChanged={reloadFestival}
        />
      )}
    </div>
  )
}
