'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getFriendArtistRatingsForFestival, type FriendArtistRating } from '@/db/actions/friends'
import type { FeedItem, FestivalFeedItem, FollowFeedItem } from '@/db/actions/friends-feed'
import RatingSquares from '@/components/rating/RatingSquares'
import UserAvatar from '@/components/UserAvatar'
import { ChevronDownIcon } from '@/components/icons'
import { formatDate, formatRelativeTime } from '@/lib/format-date'
import { getFestivalPhase } from '@/lib/festival-date'
import styles from './FriendsFeed.module.css'

const THUMB_SIZE = 128
const ARTIST_IMAGE_SIZE = 96

const VERB_BY_PHASE = { upcoming: 'is going to', ongoing: 'is at', past: 'went to' } as const

/** "{user} rated / went to / is at / is going to {festival}", from data already on the row. */
function getVerb(item: FestivalFeedItem): string {
  if (item.rating) return 'rated'
  return VERB_BY_PHASE[getFestivalPhase(item.festivalDate, item.festivalEndDate)]
}

function Headline({ item, verb, target, href }: { item: FeedItem; verb: string; target: string; href: string }) {
  return (
    <p className={styles.headline}>
      <strong>{item.username}</strong> <span className={styles.verb}>{verb}</span>{' '}
      <Link href={href} className={styles.target}>{target}</Link>
      <span className={`mono ${styles.ago}`}>{formatRelativeTime(item.updatedAt)}</span>
    </p>
  )
}

/** The DJs a friend saw at a festival, loaded on first open. */
function DjsSeen({ friendUserId, festivalId, seenCount }: { friendUserId: string; festivalId: string; seenCount: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [artists, setArtists] = useState<FriendArtistRating[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = async () => {
    const next = !isExpanded
    setIsExpanded(next)
    if (!next || artists !== null) return
    setIsLoading(true)
    try {
      setArtists(await getFriendArtistRatingsForFestival(friendUserId, festivalId))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <button type="button" className={`mono ${styles.djsToggle}`} onClick={handleToggle} aria-expanded={isExpanded}>
        DJs seen · {seenCount}
        <ChevronDownIcon size={14} strokeWidth={2} className={isExpanded ? styles.chevronOpen : undefined} />
      </button>
      {isExpanded && (
        <div className={styles.djs}>
          {isLoading && <span className={`mono ${styles.ago}`}>Loading…</span>}
          {artists?.map((a, i) => (
            <span key={i} className={styles.dj}>
              {a.artistName}
              {a.rating ? <span className={`mono ${styles.djRating}`}>{a.rating}/5</span> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function FestivalFeedRow({ item }: { item: FestivalFeedItem }) {
  const href = `/festival/${item.festivalId}`
  return (
    <article className={styles.row}>
      <UserAvatar className={`display ${styles.avatar}`} name={item.username} avatarUrl={item.avatarUrl} size={48} />
      <div className={styles.body}>
        <Headline item={item} verb={getVerb(item)} target={item.festivalName} href={href} />
        <div className={styles.festival}>
          <Link href={href} className={styles.thumb} tabIndex={-1} aria-hidden="true">
            {item.festivalImage && <Image src={item.festivalImage} alt="" width={THUMB_SIZE} height={THUMB_SIZE} sizes="64px" />}
          </Link>
          <div className={styles.festivalInfo}>
            <span className="mono">{formatDate(item.festivalDate)}</span>
            {item.publicComment && <p className={styles.quote}>&ldquo;{item.publicComment}&rdquo;</p>}
            {item.rating ? <RatingSquares value={item.rating} size="sm" /> : null}
          </div>
        </div>
        {item.seenCount > 0 && <DjsSeen friendUserId={item.userId} festivalId={item.festivalId} seenCount={item.seenCount} />}
      </div>
    </article>
  )
}

function FollowFeedRow({ item }: { item: FollowFeedItem }) {
  const href = `/artist/${item.artistId}/${encodeURIComponent(item.artistName)}`
  return (
    <article className={styles.row}>
      <UserAvatar className={`display ${styles.avatar}`} name={item.username} avatarUrl={item.avatarUrl} size={48} />
      <div className={styles.body}>
        <Headline item={item} verb="started following" target={item.artistName} href={href} />
        {item.artistImage && (
          <Link href={href} className={styles.artistThumb} tabIndex={-1} aria-hidden="true">
            <Image src={item.artistImage} alt="" width={ARTIST_IMAGE_SIZE} height={ARTIST_IMAGE_SIZE} sizes="48px" />
          </Link>
        )}
      </div>
    </article>
  )
}

export function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === 'follow') return <FollowFeedRow item={item} />
  return <FestivalFeedRow item={item} />
}
