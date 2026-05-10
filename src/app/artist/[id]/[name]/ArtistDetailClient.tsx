'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getArtistData, getOrCreateArtistByName, type ArtistData } from '@/db/actions/artists'
import { useUserData } from '@/context/UserDataContext'
import { BackIcon } from '@/components/icons'
import { SimilarArtistCard } from './SimilarArtistCard'
import { ArtistHeader, AlbumList, TopTracksList, UpcomingShowsList } from './ArtistSections'
import { getArtistShows, type ArtistShow } from '@/db/actions/artist-shows'

const MAX_TAGS = 8

export default function ArtistDetail() {
  const params = useParams()
  const router = useRouter()
  const artistId = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const encodedName = Array.isArray(params.name) ? params.name[0] : (params.name ?? '')
  const artistName = decodeURIComponent(encodedName)
  const { getRating, getNotes, setNotes } = useUserData()

  const [artist, setArtist] = useState<ArtistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [similarUrls, setSimilarUrls] = useState<Map<string, string>>(new Map())
  const [shows, setShows] = useState<ArtistShow[]>([])
  const [showsLoaded, setShowsLoaded] = useState(false)

  useEffect(() => {
    if (!artistId) return
    let cancelled = false
    setLoading(true)
    setTimedOut(false)

    // Safety timeout — if enrichment takes >15s, unblock the UI
    const timeout = setTimeout(() => {
      if (!cancelled) { setTimedOut(true); setLoading(false) }
    }, 15_000)

    ;(getArtistData(artistId) as unknown as Promise<ArtistData | null>)
      .then((data) => {
        clearTimeout(timeout)
        if (cancelled) return
        if (!data) { setNotFound(true); setLoading(false); return }
        setArtist(data)
        setLoading(false)
      })
      .catch(() => {
        clearTimeout(timeout)
        if (!cancelled) { setNotFound(true); setLoading(false) }
      })
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [artistId])

  useEffect(() => {
    if (!artist?.lastfmSimilar?.length) return
    let cancelled = false
    const unresolved = artist.lastfmSimilar.filter(a => !similarUrls.has(a.name))
    if (!unresolved.length) return
    Promise.all(
      unresolved.map(a =>
        (getOrCreateArtistByName(a.name) as unknown as Promise<{ id: string; name: string }>)
          .then(r => ({ key: a.name, url: `/artist/${r.id}/${encodeURIComponent(r.name)}` }))
          .catch(() => null)
      )
    ).then(results => {
      if (cancelled) return
      setSimilarUrls(prev => {
        const next = new Map(prev)
        results.forEach(r => { if (r) next.set(r.key, r.url) })
        return next
      })
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist?.lastfmSimilar])

  const displayImage = artist?.imageUrl ?? null
  const displayName = artist?.name ?? artistName
  const mergedTags = [...new Set(artist?.genres ?? [])].slice(0, MAX_TAGS)

  // Fetch Spotify shows once we know the artist name
  useEffect(() => {
    if (!displayName || loading) return
    let cancelled = false
    ;(getArtistShows(displayName) as unknown as Promise<ArtistShow[]>)
      .then(data => { if (!cancelled) { setShows(data); setShowsLoaded(true) } })
      .catch(() => { if (!cancelled) setShowsLoaded(true) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, loading])

  async function navigateToSimilar(name: string) {
    try {
      const result = await (getOrCreateArtistByName(name) as unknown as Promise<{ id: string; name: string }>)
      router.push(`/artist/${result.id}/${encodeURIComponent(result.name)}`)
    } catch {
      // fallback: navigate without an ID
    }
  }



  if (notFound) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎤</div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Artist not found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>We couldn&apos;t find this artist.</p>
        <button className="btn btn-primary" onClick={() => router.back()}>Go back</button>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 32 }}>
        <button className="festival-hero-back" onClick={() => router.back()} id="artist-back-btn">
          <BackIcon /> Back
        </button>

        <ArtistHeader
          displayImage={displayImage}
          displayName={displayName}
          mergedTags={mergedTags}
          loading={loading}
          artistId={artistId}
          artist={artist}
          getNotes={getNotes}
          setNotes={setNotes}
        />

        <div className="divider" />

        {(loading && !timedOut) && (
          <div>
            <div className="skeleton" style={{ height: 24, width: '30%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
          </div>
        )}

        {timedOut && !artist && (
          <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Still loading enrichment data… check back in a moment.
          </div>
        )}

        {artist?.lastfmBio && !loading && (
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title" style={{ marginBottom: 12 }}>About</h2>
            <div className="artist-bio">
              {artist.lastfmBio.split('\n').filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        )}

        {(artist?.spotifyAlbums?.length ?? 0) > 0 && !loading && (
          <AlbumList albums={artist!.spotifyAlbums} />
        )}

        {(artist?.lastfmTopTracks?.length ?? 0) > 0 && !loading && (
          <TopTracksList tracks={artist!.lastfmTopTracks} artistName={displayName} />
        )}

        {showsLoaded && !loading && (
          <UpcomingShowsList shows={shows} />
        )}

        {(artist?.lastfmSimilar?.length ?? 0) > 0 && !loading && (
          <div>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Similar Artists</h2>
            <div className="related-artists-grid">
              {artist!.lastfmSimilar.map(a => (
                <SimilarArtistCard
                  key={a.name}
                  artistName={a.name}
                  image={a.image}
                  href={similarUrls.get(a.name)}
                  onClick={() => navigateToSimilar(a.name)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
