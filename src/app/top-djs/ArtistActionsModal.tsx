'use client'

import Link from 'next/link'
import Sheet, { SheetActions } from '@/components/Sheet'
import FollowButton from '@/components/FollowButton'
import ArtistSetHistory from '@/components/ArtistSetHistory'
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

  const sets = artist.festivals
    .map((fest) => ({ festivalId: fest.id, name: fest.name, date: fest.date, rating: performanceRatings[`${fest.id}::${artist.id}`] ?? 0 }))
    .reverse()
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
      <ArtistSetHistory sets={sets} onNavigate={onClose} />
      <SheetActions>
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <Link href={`/artist/${artist.id}/${encodeURIComponent(artist.name)}`} className="btn btn-primary">
          Artist page
        </Link>
      </SheetActions>
    </Sheet>
  )
}
