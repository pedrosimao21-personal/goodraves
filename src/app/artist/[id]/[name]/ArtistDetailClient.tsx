'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getArtistData,
  getArtistDataSnapshot,
  getOrCreateArtistByName,
  clearArtistCache,
  type ArtistData,
} from '@/db/actions/artists'
import { useUserData } from '@/context/UserDataContext'
import { BackIcon } from '@/components/icons'
import { SimilarArtistCard } from './SimilarArtistCard'
import { ArtistHeader, AlbumList, TopTracksList, UpcomingShowsList } from './ArtistSections'

const MAX_TAGS = 8

export default function ArtistDetail() {
  const params = useParams()
  const router = useRouter()
  const artistId = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const encodedName = Array.isArray(params.name) ? params.name[0] : (params.name ?? '')
  const artistName = decodeURIComponent(encodedName)
  const { getAverageArtistRating, getNotes, setNotes } = useUserData()

  const [artist, setArtist] = useState<ArtistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [similarUrls, setSimilarUrls] = useState<Map<string, string>>(new Map())
  const [reportSent, setReportSent] = useState(false)

  useEffect(() => {
    if (!artistId) return
    let cancelled = false
    setLoading(true)
    setTimedOut(false)
    setReportSent(false)

    const timeout = setTimeout(() => {
      if (!cancelled) { setTimedOut(true); setLoading(false) }
    }, 15_000)

    const fetchArtist = async () => {
      try {
        // ── Step 1: Show cached DB data immediately (fast path) ──────────
        // This unblocks the UI so the user sees content within ~200ms for
        // returning visitors, rather than staring at a skeleton for 3-5s.
        const snapshot = await (getArtistDataSnapshot(artistId) as unknown as Promise<ArtistData | null>)
        if (cancelled) return

        let resolvedId = artistId

        if (snapshot) {
          setArtist(snapshot)
          setLoading(false)
          setRefreshing(true)
        }

        // ── Step 2: Refresh stale data from external APIs (slow path) ────
        // Runs after the snapshot is displayed. Updates the UI when done.
        let fresh = await (getArtistData(resolvedId) as unknown as Promise<ArtistData | null>)

        if (!fresh && !snapshot) {
          const created = await (getOrCreateArtistByName(artistName) as unknown as Promise<{ id: string; name: string }>)
          resolvedId = created.id
          fresh = await (getArtistData(created.id) as unknown as Promise<ArtistData | null>)
          if (fresh && typeof window !== 'undefined') {
            window.history.replaceState(null, '', `/artist/${fresh.id}/${encodeURIComponent(fresh.name)}`)
          }
        }

        clearTimeout(timeout)
        if (cancelled) return

        if (fresh) {
          setArtist(fresh)
        } else if (!snapshot) {
          setNotFound(true)
        }
        setLoading(false)
        setRefreshing(false)
      } catch (err) {
        clearTimeout(timeout)
        if (!cancelled) {
          try {
            const created = await (getOrCreateArtistByName(artistName) as unknown as Promise<{ id: string; name: string }>)
            const data = await (getArtistData(created.id) as unknown as Promise<ArtistData | null>)
            if (data) {
              setArtist(data)
              setLoading(false)
              setRefreshing(false)
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', `/artist/${data.id}/${encodeURIComponent(data.name)}`)
              }
              return
            }
          } catch {
            // ignore
          }
          setNotFound(true)
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    fetchArtist()
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

  async function handleReportWrongData() {
    if (!artist?.id) return
    try {
      await (clearArtistCache(artist.id) as unknown as Promise<void>)
      setReportSent(true)
      // Re-fetch fresh data after clearing cache
      setRefreshing(true)
      const fresh = await (getArtistData(artist.id) as unknown as Promise<ArtistData | null>)
      if (fresh) setArtist(fresh)
      setRefreshing(false)
    } catch {
      setRefreshing(false)
    }
  }

  async function navigateToSimilar(name: string) {
    try {
      const result = await (getOrCreateArtistByName(name) as unknown as Promise<{ id: string; name: string }>)
      router.push(`/artist/${result.id}/${encodeURIComponent(result.name)}`)
    } catch {
      // fallback: navigate without an ID
    }
  }

  const displayImage = artist?.imageUrl ?? null
  const displayName = artist?.name ?? artistName
  const mergedTags = [...new Set(artist?.genres ?? [])].slice(0, MAX_TAGS)

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
          getAverageArtistRating={getAverageArtistRating}
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

        {!loading && (
          <UpcomingShowsList
            artistName={displayName}
            raArtistId={artist?.raArtistId ?? null}
            events={artist?.raUpcomingEvents ?? []}
          />
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

        {artist && !loading && (
          <div style={{ marginTop: 48, paddingBottom: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            {refreshing && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Refreshing data…
              </p>
            )}
            {reportSent ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Cache cleared — reloading fresh data.
              </p>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleReportWrongData}
                disabled={refreshing}
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)', opacity: refreshing ? 0.5 : 1 }}
              >
                Report wrong info
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
