'use client'

import { useState } from 'react'
import Image from 'next/image'
import FollowButton from '@/components/FollowButton'
import RatingMeter from '@/components/rating/RatingMeter'
import type { RankedArtist } from './use-top-djs-ranking'
import styles from './TopDjsRanking.module.css'

const PODIUM_SIZE = 3
const PAGE_SIZE = 20
const RANK_DIGITS = 2
const PODIUM_IMAGE_SIZE = 192
const ROW_IMAGE_SIZE = 104

function formatRank(index: number): string {
  return String(index + 1).padStart(RANK_DIGITS, '0')
}

function Avatar({ artist, image, size, className }: { artist: RankedArtist; image: string | null; size: number; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {image
        ? <Image src={image} alt="" width={size} height={size} sizes={`${size / 2}px`} quality={85} />
        : <span className="display">{artist.name[0]}</span>}
    </span>
  )
}

function Rating({ value }: { value: number }) {
  if (value <= 0) return <span className={`mono ${styles.muted}`}>Not rated</span>
  return (
    <span className={styles.rating}>
      <RatingMeter value={value} size="sm" />
      <span className="mono">{value.toFixed(1)}</span>
    </span>
  )
}

interface RankingProps {
  ranking: RankedArtist[]
  imageFor: (artist: RankedArtist) => string | null
  onSelectArtist: (artist: RankedArtist) => void
}

/** Your top three as large cards. Board: TopDJs (podium). */
export function Podium({ ranking, imageFor, onSelectArtist }: RankingProps) {
  return (
    <div className={styles.podium}>
      {ranking.slice(0, PODIUM_SIZE).map((artist, index) => (
        <button
          key={artist.id}
          type="button"
          className={`${styles.podiumCard} ${index === 0 ? styles.podiumFirst : ''}`}
          onClick={() => onSelectArtist(artist)}
        >
          <span className={styles.podiumTop}>
            <span className={`display ${styles.podiumRank}`}>{formatRank(index)}</span>
            <Avatar artist={artist} image={imageFor(artist)} size={PODIUM_IMAGE_SIZE} className={styles.podiumAvatar} />
          </span>
          <span className={styles.podiumBody}>
            <span className={`display ${styles.podiumName}`}>{artist.name}</span>
            <span className={styles.podiumMeta}>
              <span className="mono">Seen {artist.count}×</span>
              <Rating value={artist.avgSetRating} />
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Everyone after the podium, paged. Board: TopDJs (rows). */
export function RankingRows({ ranking, imageFor, onSelectArtist }: RankingProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const rest = ranking.slice(PODIUM_SIZE)
  if (rest.length === 0) return null

  return (
    <div className={styles.rows}>
      {rest.slice(0, visibleCount).map((artist, i) => (
        <div key={artist.id} className={styles.row} onClick={() => onSelectArtist(artist)}>
          <span className={`display ${styles.rowRank}`}>{formatRank(i + PODIUM_SIZE)}</span>
          <Avatar artist={artist} image={imageFor(artist)} size={ROW_IMAGE_SIZE} className={styles.rowAvatar} />
          <span className={styles.rowInfo}>
            <button type="button" className={styles.rowName} onClick={(e) => { e.stopPropagation(); onSelectArtist(artist) }}>
              {artist.name}
            </button>
            <span className={styles.rowRatingMobile}><Rating value={artist.avgSetRating} /></span>
          </span>
          <span className={styles.rowRating}><Rating value={artist.avgSetRating} /></span>
          {/* FollowButton stops the click, so following doesn't also open the sheet. */}
          <FollowButton artistId={artist.id} artistName={artist.name} isCompactOnMobile />
          <span className={styles.rowSeen}>
            <span className="display">{artist.count}</span><span className={`mono ${styles.muted}`}>×</span>
          </span>
        </div>
      ))}
      {rest.length > visibleCount && (
        <button type="button" className={`btn ${styles.more}`} onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, rest.length - visibleCount)} more
        </button>
      )}
    </div>
  )
}
