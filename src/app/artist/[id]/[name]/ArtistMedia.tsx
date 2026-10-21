'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { PauseIcon, PlayIcon } from '@/components/icons'
import { formatPlaycount } from './format-counts'
import SectionHeading from './SectionHeading'
import styles from './ArtistMedia.module.css'

const RELEASE_IMAGE_SIZE = 240
const PREVIEW_ICON_SIZE = 14
const COLLAPSED_RELEASE_COUNT = 6

type SpotifyAlbum = { id: string; name: string; releaseDate: string; image: string | null; url: string | null; type: string }
type LastfmTrack = { name: string; playcount: number; url: string | null; listeners: number; previewUrl?: string | null }

export function TopTracks({ tracks, artistName }: { tracks: LastfmTrack[]; artistName: string }) {
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePreview = (previewUrl: string) => {
    if (playingUrl === previewUrl) {
      audioRef.current?.pause()
      setPlayingUrl(null)
      return
    }
    if (audioRef.current) {
      audioRef.current.src = previewUrl
      audioRef.current.play()
    }
    setPlayingUrl(previewUrl)
  }

  return (
    <section>
      <SectionHeading title="Top tracks" meta="Last.fm" size="sm" />
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} />
      <ol className={styles.tracks} id="top-tracks-list">
        {tracks.map((track, i) => {
          const trackUrl = track.url || `https://open.spotify.com/search/${encodeURIComponent(`${artistName} ${track.name}`)}`
          const isPlaying = Boolean(track.previewUrl) && playingUrl === track.previewUrl
          return (
            <li key={track.name + i} className={styles.track}>
              {track.previewUrl ? (
                <button
                  type="button"
                  className={`${styles.preview} ${isPlaying ? styles.previewOn : ''}`}
                  onClick={() => togglePreview(track.previewUrl!)}
                  aria-label={isPlaying ? `Pause ${track.name}` : `Play a 30s preview of ${track.name}`}
                  aria-pressed={isPlaying}
                >
                  {isPlaying ? <PauseIcon size={PREVIEW_ICON_SIZE} /> : <PlayIcon size={PREVIEW_ICON_SIZE} />}
                </button>
              ) : (
                <span className={`mono ${styles.trackNumber}`}>{i + 1}</span>
              )}
              <a href={trackUrl} target="_blank" rel="noreferrer" className={styles.trackName}>{track.name}</a>
              {track.playcount > 0 && <span className={`mono ${styles.trackPlays}`}>{formatPlaycount(track.playcount)}</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function Releases({ albums }: { albums: SpotifyAlbum[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const visible = isExpanded ? albums : albums.slice(0, COLLAPSED_RELEASE_COUNT)
  return (
    <section>
      <SectionHeading title="Releases" meta="Spotify" size="sm" />
      <div className={styles.releases}>
        {visible.map((album) => (
          <a key={album.id} href={album.url ?? '#'} target="_blank" rel="noreferrer" className={styles.release}>
            <span className={styles.releaseCover}>
              {album.image && (
                <Image src={album.image} alt="" width={RELEASE_IMAGE_SIZE} height={RELEASE_IMAGE_SIZE} quality={85} sizes="(max-width: 640px) 45vw, 160px" />
              )}
            </span>
            <span className={styles.releaseName} title={album.name}>{album.name}</span>
            <span className={`mono ${styles.releaseMeta}`}>
              {album.type}{album.releaseDate ? ` · ${new Date(album.releaseDate).getFullYear()}` : ''}
            </span>
          </a>
        ))}
      </div>
      {albums.length > COLLAPSED_RELEASE_COUNT && (
        <button type="button" className={`mono ${styles.showAll}`} onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Show fewer' : `Show all ${albums.length}`}
        </button>
      )}
    </section>
  )
}
