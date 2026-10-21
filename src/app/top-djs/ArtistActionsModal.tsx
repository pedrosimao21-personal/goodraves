'use client'

import Link from 'next/link'
import Sheet, { SheetActions } from '@/components/Sheet'
import FollowButton from '@/components/FollowButton'
import RatingSquares from '@/components/rating/RatingSquares'
import { formatDate } from '@/lib/format-date'
import type { RankedArtist } from './use-top-djs-ranking'
import styles from './TopDjs.module.css'

/** Your history with one artist: every festival you saw them at, with your set rating. */
export default function ArtistActionsModal({
  artist,
  onClose,
  performanceRatings,
}: {
  artist: RankedArtist | null
  onClose: () => void
  performanceRatings: Record<string, number>
}) {
  if (!artist) return null

  const eyebrow = [
    `Seen ${artist.count}×`,
    artist.avgSetRating > 0 ? `${artist.avgSetRating.toFixed(1)} average` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Sheet title={artist.name} eyebrow={eyebrow} onClose={onClose}>
      <div className={styles.sheetFollow}>
        <FollowButton artistId={artist.id} artistName={artist.name} />
      </div>
      <p className={`mono ${styles.sheetLabel}`}>Your sets</p>
      <div className={styles.history}>
        {artist.festivals.map((fest, idx) => {
          const setRating = performanceRatings?.[`${fest.id}::${artist.id}`] ?? 0
          return (
            <Link key={fest.id + idx} href={`/festival/${fest.id}`} className={styles.historyRow} onClick={onClose}>
              <span className={styles.historyInfo}>
                <span className={styles.historyName}>{fest.name}</span>
                <span className={`mono ${styles.muted}`}>{formatDate(fest.date)}</span>
              </span>
              {setRating > 0 && <RatingSquares value={setRating} size="sm" />}
            </Link>
          )
        })}
      </div>
      <SheetActions>
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <Link href={`/artist/${artist.id}/${encodeURIComponent(artist.name)}`} className="btn btn-primary">
          Artist page
        </Link>
      </SheetActions>
    </Sheet>
  )
}
