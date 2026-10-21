'use client'

import { useCallback, useMemo } from 'react'
import { useUserData } from '@/context/UserDataContext'
import type { SlotGroup } from './timetable-utils'

/**
 * The user's picks for one festival, and a toggle for a whole slot group: a
 * B2B slot is picked when any of its artists is. Picking it picks every
 * artist in it; unpicking removes the ones that were picked.
 */
export function usePicks(festivalId: string) {
  const { wantToSee, toggleWantToSee } = useUserData()
  const pickedArtistIds = useMemo(() => new Set(wantToSee[festivalId] ?? []), [wantToSee, festivalId])

  const isGroupPicked = useCallback(
    (group: SlotGroup) => group.artists.some((artist) => pickedArtistIds.has(artist.artistId)),
    [pickedArtistIds],
  )

  const togglePick = useCallback((group: SlotGroup) => {
    const picked = group.artists.filter((artist) => pickedArtistIds.has(artist.artistId))
    const targets = picked.length > 0 ? picked : group.artists
    for (const artist of targets) {
      void toggleWantToSee(festivalId, artist.artistId, { name: artist.artistName, image: artist.artistImageUrl })
    }
  }, [festivalId, pickedArtistIds, toggleWantToSee])

  return { pickedArtistIds, isGroupPicked, togglePick }
}
