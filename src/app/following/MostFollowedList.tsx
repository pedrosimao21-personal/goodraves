'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import FollowButton from '@/components/FollowButton'
import { getMostFollowedArtists } from '@/db/actions/most-followed-artists'
import type { MostFollowedArtist } from '@/db/actions/most-followed-core'
import styles from './MostFollowedList.module.css'

const AVATAR_SIZE = 88

function describe(artist: MostFollowedArtist): string {
  const ravers = `${artist.followerCount} raver${artist.followerCount === 1 ? '' : 's'}`
  return artist.upcomingCount > 0 ? `${ravers} · ${artist.upcomingCount} upcoming` : ravers
}

/**
 * Most followed artists, for someone who follows nobody and has no rated sets
 * to base suggestions on. Board: FollowingEmptyMobile ("Most followed on Goodraves").
 */
export default function MostFollowedList() {
  const [artists, setArtists] = useState<MostFollowedArtist[]>([])

  useEffect(() => {
    let isCancelled = false
    getMostFollowedArtists()
      .then((next) => { if (!isCancelled) setArtists(next) })
      .catch((err) => {
        // The search above still works; the list just doesn't show.
        console.error('[following] Failed to load most followed artists:', err)
        if (!isCancelled) setArtists([])
      })
    return () => { isCancelled = true }
  }, [])

  if (artists.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="most-followed-title">
      <h2 id="most-followed-title" className={`mono ${styles.title}`}>Most followed on Goodraves</h2>
      {artists.map((artist) => {
        const href = `/artist/${artist.artistId}/${encodeURIComponent(artist.name)}`
        return (
          <div key={artist.artistId} className={styles.row}>
            <Link href={href} className={styles.avatar} tabIndex={-1} aria-hidden="true">
              {artist.imageUrl
                ? <Image src={artist.imageUrl} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} sizes="44px" />
                : <span className="display">{artist.name[0]}</span>}
            </Link>
            <span className={styles.info}>
              <Link href={href} className={styles.name}>{artist.name}</Link>
              <span className={`mono ${styles.meta}`}>{describe(artist)}</span>
            </span>
            <FollowButton artistId={artist.artistId} artistName={artist.name} />
          </div>
        )
      })}
      <p className={styles.note}>Once you rate a few sets, this list switches to artists you rated highly.</p>
    </section>
  )
}
