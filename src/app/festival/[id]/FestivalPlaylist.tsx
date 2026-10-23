'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { FestivalPlaylistData } from '@/db/actions/festival-playlist'
import { ExternalIcon, SpotifyIcon } from '@/components/icons'
import styles from './FestivalDetail.module.css'

const EMBED_HEIGHT = 352

/**
 * Spotify playlist panel. The embedded player sets Spotify's own cookies, so
 * it only loads after the visitor asks for it — that's what lets the site run
 * without a cookie banner (see /privacy). Board: Festival (bottom).
 */
export default function FestivalPlaylist({ playlist, festivalName }: { playlist: FestivalPlaylistData; festivalName: string }) {
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(false)
  const spotifyFallbackUrl = `https://open.spotify.com/search/${encodeURIComponent(festivalName)}`
  const embedUrl = playlist.id ? `https://open.spotify.com/embed/playlist/${playlist.id}?utm_source=generator&theme=0` : null

  return (
    <section className={styles.playlist}>
      <div className={styles.playlistHeader}>
        <div>
          <p className={`mono ${styles.playlistEyebrow}`}><SpotifyIcon size={14} />Festival playlist</p>
          <h2 className={`display ${styles.playlistTitle}`}>{festivalName}</h2>
        </div>
        <a href={playlist.url ?? spotifyFallbackUrl} target="_blank" rel="noreferrer" className="btn">
          Open in Spotify<ExternalIcon size={14} strokeWidth={2} />
        </a>
      </div>
      {!embedUrl && <p className={styles.playlistMissing}>Playlist not available to embed.</p>}
      {embedUrl && isPlayerLoaded && (
        <iframe
          className={styles.playlistEmbed}
          src={embedUrl}
          title={`${festivalName} playlist on Spotify`}
          width="100%"
          height={EMBED_HEIGHT}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}
      {embedUrl && !isPlayerLoaded && (
        <div className={styles.playlistConsent} style={{ minHeight: EMBED_HEIGHT }}>
          <button type="button" className="btn btn-primary" onClick={() => setIsPlayerLoaded(true)}>
            <SpotifyIcon size={16} />Load Spotify player
          </button>
          <p className={styles.playlistConsentNote}>
            Loading the player lets Spotify set cookies. <Link href="/privacy">Privacy</Link>
          </p>
        </div>
      )}
    </section>
  )
}
