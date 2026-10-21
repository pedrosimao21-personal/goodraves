'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { ArtistData } from '@/db/actions/artists'
import type { ArtistFollowContext } from '@/db/actions/artist-follow-context'
import FollowButton from '@/components/FollowButton'
import RatingSquares from '@/components/rating/RatingSquares'
import { ArrowLeftIcon, ExternalIcon } from '@/components/icons'
import { formatNameList } from '@/lib/following-display'
import { formatFollowers } from './format-counts'
import styles from './ArtistHeader.module.css'

const PHOTO_SIZE = 680
const MAX_TAGS = 8
const MONOGRAM_WORDS = 2
/** Names longer than this step down a display size. */
const LONG_NAME_LENGTH = 16

function toMonogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, MONOGRAM_WORDS).map((word) => word[0]).join('')
}

type Stat = { value: string; label: string; rating?: number }

function buildStats(artist: ArtistData | null, averageRating: number, context: ArtistFollowContext | null): Stat[] {
  const stats: Stat[] = []
  if (averageRating > 0) stats.push({ value: averageRating.toFixed(1), label: 'Your average', rating: averageRating })
  if ((artist?.spotifyFollowers ?? 0) > 0) {
    stats.push({ value: formatFollowers(artist?.spotifyFollowers), label: 'Spotify followers' })
  } else if ((artist?.lastfmListeners ?? 0) > 0) {
    stats.push({ value: formatFollowers(artist?.lastfmListeners), label: 'Last.fm listeners' })
  }
  if (context && context.followerCount > 0) {
    const friends = context.friendsFollowing.length > 0 ? ` · incl. ${formatNameList(context.friendsFollowing)}` : ''
    stats.push({ value: String(context.followerCount), label: `${context.followerCount === 1 ? 'Raver follows' : 'Ravers follow'}${friends}` })
  }
  return stats
}

interface ArtistHeaderProps {
  displayName: string
  artist: ArtistData | null
  averageRating: number
  followContext: ArtistFollowContext | null
}

/** Board: Artist (desktop) and ArtistMobile. */
export default function ArtistHeader({ displayName, artist, averageRating, followContext }: ArtistHeaderProps) {
  const router = useRouter()
  const tags = [...new Set(artist?.genres ?? [])].slice(0, MAX_TAGS)
  const stats = buildStats(artist, averageRating, followContext)
  const links = [
    artist?.spotifyId ? { label: 'Spotify', href: `https://open.spotify.com/artist/${artist.spotifyId}` } : null,
    artist?.lastfmId ? { label: 'Last.fm', href: `https://www.last.fm/music/${encodeURIComponent(artist.name)}` } : null,
    { label: 'Resident Advisor', href: `https://ra.co/dj/${displayName.toLowerCase().replace(/\s+/g, '')}` },
  ].filter((link): link is { label: string; href: string } => link !== null)

  return (
    <section className={styles.header}>
      <button type="button" className={`mono ${styles.back}`} onClick={() => router.back()} id="artist-back-btn">
        <ArrowLeftIcon size={16} strokeWidth={2} />Back
      </button>

      <div className={styles.top}>
        <div className={styles.photo}>
          {artist?.imageUrl ? (
            <Image src={artist.imageUrl} alt={displayName} width={PHOTO_SIZE} height={PHOTO_SIZE} sizes="(max-width: 640px) 100vw, 340px" quality={85} priority />
          ) : (
            <span className={`display ${styles.monogram}`} aria-hidden="true">{toMonogram(displayName)}</span>
          )}
        </div>

        <div className={styles.info}>
          <p className={`mono ${styles.eyebrow}`}>Artist{artist?.countryName ? ` · ${artist.countryName}` : ''}</p>
          <h1 className={`display ${styles.name} ${displayName.length > LONG_NAME_LENGTH ? styles.nameLong : ''}`}>{displayName}</h1>
          {tags.length > 0 && (
            <div className={styles.tags}>
              {tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
            </div>
          )}
          <div className={styles.actions}>
            {/* Follow the loaded DB row, never the URL id (it can be a not-yet-resolved one). */}
            {artist && <FollowButton artistId={artist.id} artistName={artist.name} size="md" />}
            {/* On mobile only the first link stays a button; the rest become text links. */}
            {links.map((link, index) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className={`btn ${index > 0 ? styles.secondaryLink : ''}`}>
                {link.label}<ExternalIcon size={14} strokeWidth={2} />
              </a>
            ))}
          </div>
        </div>
      </div>

      {stats.length > 0 && (
        <div className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <div className={styles.statValue}>
                <span className="display">{stat.value}</span>
                {stat.rating !== undefined && <RatingSquares value={stat.rating} />}
              </div>
              <p className={`mono ${styles.statLabel}`}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
