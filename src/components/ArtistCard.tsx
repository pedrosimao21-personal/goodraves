'use client'

import { memo, useState, lazy, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUserDataActions } from '../context/UserDataContext'
import StarRating from './StarRating'
import RatingSquares from './rating/RatingSquares'
import ArtistOptionsMenu from './ArtistOptionsMenu'
import FollowButton from './FollowButton'
import { BookmarkIcon, DotsIcon } from './icons'
import styles from './ArtistCard.module.css'

const ArtistRenameModal = lazy(() => import('./ArtistRenameModal'))
const B2bSplitModal = lazy(() => import('./B2bSplitModal'))
const B2bCreateModal = lazy(() => import('./B2bCreateModal'))

type MenuState = 'closed' | 'options' | 'rename' | 'split' | 'createB2b'

const AVATAR_SIZE = 240
const MONOGRAM_LETTERS = 2
const PICK_ICON_SIZE = 16

function monogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, MONOGRAM_LETTERS).map((word) => word[0]).join('')
}

const ArtistCard = memo(function ArtistCard({
  artist,
  eventId,
  spotifyData,
  canPick = false,
  canRate = true,
  availableArtistsForB2b = [],
}: {
  artist: any
  eventId: string
  spotifyData?: any
  /** Show the pick toggle (festival not over yet). */
  canPick?: boolean
  /** Show the rating controls (festival has started). */
  canRate?: boolean
  availableArtistsForB2b?: { id: string; name: string }[]
}) {
  const { getAverageArtistRating, getPerformanceRating, splitB2bArtist, renameArtist, createB2bSet, isAdmin, didWantToSee, toggleWantToSee } = useUserDataActions()
  const averageRating = getAverageArtistRating(artist.id)
  const performanceRating = getPerformanceRating(eventId, artist.id)
  const wantsToSee = didWantToSee(eventId, artist.id)
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
      <article className={`${styles.card} fade-in`} id={`artist-${artist.id}`}>
        <Link href={artistHref} aria-label={displayName} className={styles.cardLink} />

        <div className={styles.avatar}>
          {displayImage ? (
            <Image
              className={styles.avatarImage}
              src={displayImage}
              alt=""
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              quality={85}
              sizes="(max-width: 640px) 50vw, 240px"
            />
          ) : (
            <span className={`display ${styles.monogram}`} aria-hidden="true">{monogram(displayName)}</span>
          )}
          <span className={styles.overlay}>
            <FollowButton artistId={dbId} artistName={displayName} variant="icon" />
          </span>
          {isAdmin && (
            <button
              type="button"
              className={styles.adminButton}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuState('options') }}
              aria-label={`Admin options for ${displayName}`}
            >
              <DotsIcon />
            </button>
          )}
        </div>

        <div className={styles.info}>
          <div>
            <h3 className={styles.name}>{displayName}</h3>
            {averageRating > 0 && (
              <span className={`mono ${styles.average}`} title={`Your average rating: ${averageRating.toFixed(1)}`}>
                <RatingSquares value={averageRating} size="sm" />
                {averageRating.toFixed(1)}
              </span>
            )}
          </div>
          {canPick && (
            <div className={styles.controls}>
              <button
                type="button"
                className={`${styles.pick} ${wantsToSee ? styles.pickActive : ''}`}
                onClick={() => toggleWantToSee(eventId, artist.id, { name: artist.name, image: artist.image })}
                aria-pressed={wantsToSee}
                aria-label={wantsToSee ? `Remove ${displayName} from your picks` : `Add ${displayName} to your picks`}
              >
                <BookmarkIcon size={PICK_ICON_SIZE} filled={wantsToSee} />
              </button>
            </div>
          )}
        </div>

        {canRate && (
          <div className={styles.controls}>
            {hasRating || isStarRatingVisible ? (
              <>
                <StarRating artistId={artist.id} eventId={eventId} artistName={displayName} />
                {/* Escape hatch for a mis-tap: only while the squares were opened
                    manually and nothing has been rated yet, so there is no
                    saved rating to undo — just hide them again. */}
                {isStarRatingVisible && !hasRating && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setIsStarRatingVisible(false)}
                    aria-label={`Cancel marking ${displayName} as seen`}
                  >
                    Cancel
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setIsStarRatingVisible(true)}
                aria-label={`Mark ${displayName} as seen`}
              >
                Mark seen
              </button>
            )}
          </div>
        )}
      </article>

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
          <ArtistRenameModal artistName={displayName} onSave={handleRename} onClose={closeMenu} />
        </Suspense>
      )}

      {menuState === 'split' && (
        <Suspense fallback={null}>
          <B2bSplitModal artistName={displayName} onSave={handleSplit} onClose={closeMenu} />
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
