'use client'

import { memo, useState, lazy, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUserData } from '../context/UserDataContext'
import StarRating from './StarRating'
import ArtistOptionsMenu from './ArtistOptionsMenu'

const ArtistRenameModal = lazy(() => import('./ArtistRenameModal'))
const B2bSplitModal = lazy(() => import('./B2bSplitModal'))
const B2bCreateModal = lazy(() => import('./B2bCreateModal'))

type MenuState = 'closed' | 'options' | 'rename' | 'split' | 'createB2b'

const ArtistCard = memo(function ArtistCard({
  artist,
  eventId,
  spotifyData,
  isPast = true,
  availableArtistsForB2b = [],
}: {
  artist: any
  eventId: string
  spotifyData?: any
  isPast?: boolean
  availableArtistsForB2b?: { id: string; name: string }[]
}) {
  const { getAverageArtistRating, getPerformanceRating, splitB2bArtist, renameArtist, createB2bSet, isAdmin } = useUserData()
  const averageRating = getAverageArtistRating(artist.id)
  const performanceRating = getPerformanceRating(eventId, artist.id)
  const [isStarRatingVisible, setIsStarRatingVisible] = useState(false)
  const [menuState, setMenuState] = useState<MenuState>('closed')
  const [nameOverride, setNameOverride] = useState<string | null>(null)
  const hasRating = performanceRating > 0

  const displayName = nameOverride ?? artist.name
  const displayImage = artist.image || spotifyData?.image || null

  // Use the real DB id from spotifyData if available, otherwise fall back to artist.id
  const dbId = spotifyData?.id || artist.id
  const artistHref = `/artist/${dbId}/${encodeURIComponent(displayName)}`

  const handleSplit = async (memberNames: string[]) => {
    await splitB2bArtist(eventId, artist.id, memberNames)
    setMenuState('closed')
  }

  const handleCreateB2b = async (memberArtistIds: string[]) => {
    await createB2bSet(eventId, memberArtistIds)
    setMenuState('closed')
  }

  const handleRename = async (newName: string) => {
    await renameArtist(eventId, artist.id, newName)
    setNameOverride(newName)
    setMenuState('closed')
  }

  const closeMenu = () => setMenuState('closed')

  return (
    <>
      <div className="artist-card fade-in" id={`artist-${artist.id}`} style={{ position: 'relative' }}>
        {/* Stretched link covers the entire card; interactive elements sit above it via position:relative */}
        <Link href={artistHref} aria-label={displayName} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'contents' }}>
          {displayImage ? (
            <Image
              className="artist-avatar"
              src={displayImage}
              alt={displayName}
              width={48}
              height={48}
              quality={85}
              sizes="48px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="artist-avatar-placeholder">🎤</div>
          )}
          <div className="artist-name">
            {displayName}
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
                aria-label={`Mark ${displayName} as seen`}
              >
                Mark as seen
              </button>
            )}
          </div>
        )}

        {/* Options button — visible on card hover only, admin-only */}
        {isAdmin && (
          <button
            className="artist-card-options-btn"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuState('options') }}
            title="Options"
          >
            &#8943;
          </button>
        )}
      </div>

      {menuState === 'options' && (
        <ArtistOptionsMenu
          onEditName={() => setMenuState('rename')}
          onSplitB2b={() => setMenuState('split')}
          onCreateB2b={() => setMenuState('createB2b')}
          onClose={closeMenu}
        />
      )}

      {menuState === 'rename' && (
        <Suspense fallback={null}>
          <ArtistRenameModal
            artistName={displayName}
            onSave={handleRename}
            onClose={closeMenu}
          />
        </Suspense>
      )}

      {menuState === 'split' && (
        <Suspense fallback={null}>
          <B2bSplitModal
            artistName={displayName}
            onSave={handleSplit}
            onClose={closeMenu}
          />
        </Suspense>
      )}

      {menuState === 'createB2b' && (
        <Suspense fallback={null}>
          <B2bCreateModal
            initiatingArtist={{ id: artist.id, name: displayName }}
            availableArtists={availableArtistsForB2b}
            onSave={handleCreateB2b}
            onClose={closeMenu}
          />
        </Suspense>
      )}
    </>
  )
})

export default ArtistCard
