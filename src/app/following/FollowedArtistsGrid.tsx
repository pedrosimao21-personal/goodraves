'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FollowButton from '@/components/FollowButton'
import type { FollowedArtist } from '@/db/actions/following-feed'
import { formatDate } from '@/lib/format-date'
import { formatNameList } from '@/lib/following-display'
import styles from './Following.module.css'

const AVATAR_SIZE = 88
const COLLAPSED_COUNT = 8

function describeNext(artist: FollowedArtist): string {
  if (!artist.nextGig) return 'No upcoming gigs yet'
  const more = artist.upcomingCount - 1
  return `Next · ${artist.nextGig.name} · ${formatDate(artist.nextGig.date)}${more > 0 ? ` · +${more}` : ''}`
}

function FollowedArtistRow({ artist }: { artist: FollowedArtist }) {
  const href = `/artist/${artist.artistId}/${encodeURIComponent(artist.name)}`
  return (
    <div className={styles.followRow}>
      <Link href={href} className={styles.avatar} aria-label={artist.name}>
        {artist.imageUrl
          ? <Image src={artist.imageUrl} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} sizes="44px" />
          : <span className="display" aria-hidden="true">{artist.name[0]}</span>}
      </Link>
      <div className={styles.followInfo}>
        <Link href={href} className={styles.followName}>{artist.name}</Link>
        {artist.nextGig ? (
          <Link href={`/festival/${artist.nextGig.festivalId}`} className={`mono ${styles.followMeta}`}>{describeNext(artist)}</Link>
        ) : (
          <span className={`mono ${styles.followMeta}`}>{describeNext(artist)}</span>
        )}
        {artist.friendsFollowing.length > 0 && (
          <span className={`mono ${styles.followMeta}`}>
            {formatNameList(artist.friendsFollowing)} {artist.friendsFollowing.length === 1 ? 'follows' : 'follow'} too
          </span>
        )}
      </div>
      <FollowButton artistId={artist.artistId} artistName={artist.name} variant="icon" />
    </div>
  )
}

/** The artists you follow, each with their next gig. Board: Following (aside). */
export default function FollowedArtistsGrid({ artists }: { artists: FollowedArtist[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const visible = isExpanded ? artists : artists.slice(0, COLLAPSED_COUNT)

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={`display ${styles.asideTitle}`}>You follow <span className={styles.count}>{artists.length}</span></h2>
      </div>
      {visible.map((artist) => <FollowedArtistRow key={artist.artistId} artist={artist} />)}
      {artists.length > COLLAPSED_COUNT && (
        <button type="button" className={`btn ${styles.fullWidth}`} onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Show fewer' : `Show all ${artists.length}`}
        </button>
      )}
    </div>
  )
}
