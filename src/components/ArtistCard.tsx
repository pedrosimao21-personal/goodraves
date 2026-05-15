'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUserData } from '../context/UserDataContext'
import StarRating from './StarRating'
import B2bSplitModal from './B2bSplitModal'

const ArtistCard = memo(function ArtistCard({
  artist,
  eventId,
  spotifyData,
  isPast = true,
}: {
  artist: any
  eventId: string
  spotifyData?: any
  isPast?: boolean
}) {
  const { getAverageArtistRating, getPerformanceRating, splitB2bArtist } = useUserData()
  const averageRating = getAverageArtistRating(artist.id)
  const performanceRating = getPerformanceRating(eventId, artist.id)
  const [isStarRatingVisible, setIsStarRatingVisible] = useState(false)
  const [showSplitModal, setShowSplitModal] = useState(false)
  const hasRating = performanceRating > 0

  const displayImage = artist.image || spotifyData?.image || null

  // Use the real DB id from spotifyData if available, otherwise fall back to artist.id
  const dbId = spotifyData?.id || artist.id
  const artistHref = `/artist/${dbId}/${encodeURIComponent(artist.name)}`

  const handleSplit = async (memberNames: string[]) => {
    await splitB2bArtist(eventId, artist.id, memberNames)
    setShowSplitModal(false)
  }

  return (
    <>
      <div className="artist-card fade-in" id={`artist-${artist.id}`} style={{ position: 'relative' }}>
        {/* Stretched link covers the entire card; interactive elements sit above it via position:relative */}
        <Link href={artistHref} aria-label={artist.name} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'contents' }}>
          {displayImage ? (
            <Image
              className="artist-avatar"
              src={displayImage}
              alt={artist.name}
              width={48}
              height={48}
              quality={90}
              sizes="48px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="artist-avatar-placeholder">🎤</div>
          )}
          <div className="artist-name">
            {artist.name}
            {averageRating > 0 && (
              <span className="artist-avg-rating" title={`Your average rating: ${averageRating.toFixed(1)}`}>
                <span className="artist-avg-rating-star">★</span> {averageRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {isPast && (
          <div style={{ position: 'relative', zIndex: 1 }}>
            {hasRating || isStarRatingVisible ? (
              <StarRating artistId={artist.id} eventId={eventId} readonly={false} size="md" />
            ) : (
              <button
                className="mark-seen-btn"
                onClick={() => setIsStarRatingVisible(true)}
                aria-label={`Mark ${artist.name} as seen`}
              >
                Mark as seen
              </button>
            )}
          </div>
        )}

        {/* Split B2B button — visible on card hover only */}
        <button
          className="artist-card-options-btn"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSplitModal(true) }}
          title="Split B2B artist"
        >
          &#8943;
        </button>
      </div>

      {showSplitModal && (
        <B2bSplitModal
          artistName={artist.name}
          onSave={handleSplit}
          onClose={() => setShowSplitModal(false)}
        />
      )}
    </>
  )
})

export default ArtistCard
