'use client'

import { useParams, useRouter } from 'next/navigation'
import type { ArtistData } from '@/db/actions/artists'
import { useUserData } from '@/context/UserDataContext'
import PageMessage from '@/components/PageMessage'
import ArtistHeader from './ArtistHeader'
import ArtistAside from './ArtistAside'
import ArtistUpcoming from './ArtistUpcoming'
import { mergeUpcomingShows } from './upcoming-merge'
import ArtistYourSets from './ArtistYourSets'
import { Releases, TopTracks } from './ArtistMedia'
import { useArtistData } from './use-artist-data'
import { useArtistFollowContext } from './use-artist-follow-context'
import bodyStyles from './ArtistBody.module.css'
import pageStyles from './ArtistPage.module.css'

export default function ArtistDetail({ initialArtist = null }: { initialArtist?: ArtistData | null }) {
  const params = useParams()
  const router = useRouter()
  const artistId = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const encodedName = Array.isArray(params.name) ? params.name[0] : (params.name ?? '')
  const artistName = decodeURIComponent(encodedName)
  const { getAverageArtistRating, getArtistHistory } = useUserData()
  const { artist, loading, refreshing, notFound, timedOut, reportSent, reportWrongData } =
    useArtistData(artistId, artistName, initialArtist)
  // The URL id can be a not-yet-resolved one (see getOrCreateArtistByName), so
  // follow data comes from the loaded DB row, never the URL id.
  const followContext = useArtistFollowContext(artist?.id ?? null)

  if (notFound) {
    return (
      <PageMessage isAlert title="Artist not found." text="We couldn't find this artist.">
        <button type="button" className="btn btn-primary" onClick={() => router.back()}>Go back</button>
      </PageMessage>
    )
  }

  const displayName = artist?.name ?? artistName
  // Ratings and seen sets are keyed by the DB id; the URL id can still be unresolved.
  const resolvedId = artist?.id ?? artistId
  const history = loading ? [] : getArtistHistory(resolvedId)
  const hasTracks = (artist?.lastfmTopTracks?.length ?? 0) > 0
  const hasAlbums = (artist?.spotifyAlbums?.length ?? 0) > 0

  return (
    <div className="page">
      <div className="container">
        <ArtistHeader
          displayName={displayName}
          artist={artist}
          averageRating={loading ? 0 : getAverageArtistRating(resolvedId)}
          seenCount={history.length}
          followContext={followContext}
        />

        {loading && !timedOut && (
          <div className={pageStyles.skeleton} aria-busy="true" aria-label="Loading artist">
            <div className={`skeleton ${pageStyles.skeletonHeading}`} />
            <div className={`skeleton ${pageStyles.skeletonBlock}`} />
          </div>
        )}

        {timedOut && !artist && (
          <p className={pageStyles.slowNote}>Still loading enrichment data… check back in a moment.</p>
        )}

        {!loading && (
          <div className={bodyStyles.body}>
            <div className={bodyStyles.main}>
              {/* Waits for our own upcoming list, so RA-only rows don't jump when it arrives. */}
              {followContext ? (
                <ArtistUpcoming
                  shows={mergeUpcomingShows(followContext.upcomingFestivals, artist?.raUpcomingEvents ?? [])}
                  artistName={displayName}
                  raArtistId={artist?.raArtistId ?? null}
                />
              ) : (
                <div className={`skeleton ${pageStyles.skeletonBlock}`} aria-busy="true" aria-label="Loading upcoming shows" />
              )}
              <ArtistYourSets sets={history} />
              {(hasTracks || hasAlbums) && (
                <div className={bodyStyles.mediaGrid}>
                  {hasTracks && <TopTracks tracks={artist!.lastfmTopTracks} artistName={displayName} />}
                  {hasAlbums && <Releases albums={artist!.spotifyAlbums} />}
                </div>
              )}
            </div>
            <ArtistAside
              artistId={artistId}
              artist={artist}
              refreshing={refreshing}
              reportSent={reportSent}
              onReportWrongData={reportWrongData}
            />
          </div>
        )}
      </div>
    </div>
  )
}
