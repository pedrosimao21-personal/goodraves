import type { FestivalPlaylistData } from '@/db/actions/festival-playlist'
import { ExternalIcon, SpotifyIcon } from '@/components/icons'
import styles from './FestivalDetail.module.css'

const EMBED_HEIGHT = 352

/** Spotify playlist panel with the embedded player. Board: Festival (bottom). */
export default function FestivalPlaylist({ playlist, festivalName }: { playlist: FestivalPlaylistData; festivalName: string }) {
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
      {embedUrl ? (
        <iframe
          className={styles.playlistEmbed}
          src={embedUrl}
          title={`${festivalName} playlist on Spotify`}
          width="100%"
          height={EMBED_HEIGHT}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <p className={styles.playlistMissing}>Playlist not available to embed.</p>
      )}
    </section>
  )
}
