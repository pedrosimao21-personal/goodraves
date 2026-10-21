'use client'

import { useMemo } from 'react'
import { useUserData } from '@/context/UserDataContext'
import ArtistCard from '@/components/ArtistCard'
import B2bSetCard from '@/components/B2bSetCard'
import type { FestivalEvent } from './festival-event'
import styles from './FestivalLineup.module.css'

type Props = {
  id: string
  event: FestivalEvent
  spotifyData: Record<string, any>
  canPick: boolean
  canRate: boolean
}

/** The A–Z view: B2B sets first, then every solo artist as a card. Board: Festival. */
export default function LineupArtistGrid({ id, event, spotifyData, canPick, canRate }: Props) {
  const { getB2bSets } = useUserData()
  const b2bSets = getB2bSets(id)
  const { soloArtists, allSoloForB2b } = useMemo(() => {
    const b2bMemberIds = new Set(b2bSets.flatMap(s => s.members.map(m => m.artistId)))
    const b2bOriginalNames = new Set(b2bSets.map(s => s.originalArtistName.toLowerCase()))
    const solo = event.attractions.filter(
      (artist: any) => !b2bMemberIds.has(artist.id) && !b2bOriginalNames.has(artist.name.toLowerCase())
    )
    // Computed once here rather than per card.
    return { soloArtists: solo, allSoloForB2b: solo.map((a: any) => ({ id: a.id, name: a.name })) }
  }, [b2bSets, event])

  return (
    <>
      {canRate && <p className={styles.hint}>Tap a square to rate a set. Rating it marks it as seen.</p>}
      <div className={styles.grid}>
        {b2bSets.map(b2bSet => (
          <B2bSetCard key={b2bSet.id} b2bSet={b2bSet} eventId={id} spotifyData={spotifyData} canRate={canRate} />
        ))}
        {soloArtists.map((artist: any) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            eventId={id}
            spotifyData={spotifyData[artist.name]}
            canPick={canPick}
            canRate={canRate}
            availableArtistsForB2b={allSoloForB2b}
          />
        ))}
      </div>
    </>
  )
}
