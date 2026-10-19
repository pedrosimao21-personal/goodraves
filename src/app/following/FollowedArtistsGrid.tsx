'use client'

import Link from 'next/link'
import Image from 'next/image'
import FollowButton from '@/components/FollowButton'
import type { FollowedArtist } from '@/db/actions/following-feed'
import { formatDate } from '@/lib/format-date'
import { formatNameList } from '@/lib/following-display'

const AVATAR_SIZE = 56

function NextGigLine({ artist }: { artist: FollowedArtist }) {
  if (!artist.nextGig) {
    return <span style={{ color: 'var(--text-muted)' }}>No upcoming gigs on Goodraves yet</span>
  }
  const moreCount = artist.upcomingCount - 1
  return (
    <span>
      Next:{' '}
      <Link href={`/festival/${artist.nextGig.festivalId}`} style={{ color: 'inherit', fontWeight: 600 }}>
        {artist.nextGig.name}
      </Link>
      {' · '}{formatDate(artist.nextGig.date)}
      {moreCount > 0 && <span style={{ color: 'var(--text-muted)' }}> (+{moreCount} more)</span>}
    </span>
  )
}

function FollowedArtistCard({ artist }: { artist: FollowedArtist }) {
  const href = `/artist/${artist.artistId}/${encodeURIComponent(artist.name)}`
  return (
    <div className="followed-artist-card">
      <Link href={href} style={{ flexShrink: 0 }} aria-label={artist.name}>
        {artist.imageUrl ? (
          <Image src={artist.imageUrl} alt={artist.name} width={AVATAR_SIZE} height={AVATAR_SIZE} sizes={`${AVATAR_SIZE}px`} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div className="followed-artist-placeholder">🎤</div>
        )}
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={href} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>{artist.name}</Link>
        <div style={{ fontSize: '0.78rem', marginTop: 2 }}>
          <NextGigLine artist={artist} />
        </div>
        {artist.friendsFollowing.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            👥 {formatNameList(artist.friendsFollowing)} {artist.friendsFollowing.length === 1 ? 'follows' : 'follow'} too
          </div>
        )}
      </div>
      <FollowButton artistId={artist.artistId} artistName={artist.name} />
    </div>
  )
}

export default function FollowedArtistsGrid({ artists }: { artists: FollowedArtist[] }) {
  return (
    <div className="followed-artists-grid">
      {artists.map((artist) => (
        <FollowedArtistCard key={artist.artistId} artist={artist} />
      ))}
    </div>
  )
}
