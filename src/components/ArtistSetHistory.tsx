import Link from 'next/link'
import type { ArtistSetEntry } from '@/context/user-data-state'
import RatingMeter from './rating/RatingMeter'
import { formatDate } from '@/lib/format-date'
import styles from './ArtistSetHistory.module.css'

type Props = {
  sets: ArtistSetEntry[]
  /** Called when a row is followed, e.g. to close the sheet it sits in. */
  onNavigate?: () => void
}

/** Your sets with one artist: date, festival and your rating. Boards: Artist and ArtistMobile ("Your sets"). */
export default function ArtistSetHistory({ sets, onNavigate }: Props) {
  return (
    <div>
      {sets.map((set) => (
        <Link key={set.festivalId} href={`/festival/${set.festivalId}`} className={styles.row} onClick={onNavigate}>
          <span className={`mono ${styles.date}`}>{formatDate(set.date)}</span>
          <span className={styles.name}>{set.name}</span>
          <span className={styles.rating}>
            {set.rating > 0 ? <RatingMeter value={set.rating} size="sm" /> : <span className={`mono ${styles.unrated}`}>Not rated</span>}
          </span>
        </Link>
      ))}
    </div>
  )
}
