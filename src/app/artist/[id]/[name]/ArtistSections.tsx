'use client'

import Image from 'next/image'
import { useState, useRef } from 'react'
import { type ArtistData } from '@/db/actions/artists'
import StarRating from '@/components/StarRating'
import { ResidentAdvisorIcon, SpotifyIcon } from '@/components/icons'
import { formatFollowers, formatPlaycount } from './format-counts'

import { MAX_NOTES_LENGTH } from '@/lib/constants'

type SpotifyAlbum = { id: string; name: string; releaseDate: string; image: string | null; url: string | null; type: string }
type LastfmTrack = { name: string; playcount: number; url: string | null; listeners: number; previewUrl?: string | null }

export function ArtistHeader({
  displayImage,
  displayName,
  mergedTags,
  loading,
  artistId,
  artist,
  getNotes,
  setNotes,
}: {
  displayImage: string | null
  displayName: string
  mergedTags: string[]
  loading: boolean
  artistId: string
  artist: ArtistData | null
  getNotes: (id: string) => string
  setNotes: (id: string, value: string) => void
}) {
  return (
    <div className="artist-detail-header">
      {displayImage ? (
        <Image
          className="artist-detail-img"
          src={displayImage}
          alt={displayName}
          width={200}
          height={200}
          sizes="(max-width: 768px) 140px, 200px"
          quality={90}
          priority
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div className="artist-detail-img-placeholder">🎤</div>
      )}

      <div className="artist-detail-info">
        <h1 className="artist-detail-name">{displayName}</h1>

        {mergedTags.length > 0 && (
          <div className="artist-detail-tags">
            {mergedTags.map((tag: string) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}

        {!loading && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your rating:</span>
            <StarRating artistId={artistId} readonly={false} size="md" />
          </div>
        )}

        {!loading && (
          <div style={{ marginTop: 8 }}>
            <textarea
              placeholder="Add notes about this artist..."
              value={getNotes(artistId)}
              onChange={(e) => setNotes(artistId, e.target.value)}
              rows={2}
              maxLength={MAX_NOTES_LENGTH}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.85rem',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              id="artist-notes"
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          {(artist?.spotifyFollowers ?? 0) > 0 && (
            <span className="artist-stat">
              <SpotifyIcon size={14} />
              {formatFollowers(artist?.spotifyFollowers)} followers
            </span>
          )}
          {artist?.lastfmListeners && (
            <span className="artist-stat">
              👥 {artist.lastfmListeners.toLocaleString()} Last.fm listeners
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          {artist?.spotifyId && (
            <a
              href={`https://open.spotify.com/artist/${artist.spotifyId}`}
              target="_blank"
              rel="noreferrer"
              className="btn spotify-link btn-sm"
              id="spotify-link"
            >
              <SpotifyIcon size={16} /> Open in Spotify
            </a>
          )}
          {artist?.lastfmId && (
            <a
              href={`https://www.last.fm/music/${encodeURIComponent(artist.name)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              id="lastfm-link"
            >
              View on Last.fm ↗
            </a>
          )}
          <a
            href={`https://ra.co/dj/${displayName.toLowerCase().replace(/\s+/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm ra-link"
            id="ra-link"
          >
            <ResidentAdvisorIcon size={16} /> Resident Advisor
          </a>
        </div>
      </div>
    </div>
  )
}

export function AlbumList({ albums }: { albums: SpotifyAlbum[] }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 className="section-title" style={{ marginBottom: 16 }}>
        Latest Releases
        <span className="spotify-badge-inline"><SpotifyIcon size={13} /></span>
      </h2>
      <div className="album-list">
        {albums.map(album => (
          <a key={album.id} href={album.url ?? '#'} target="_blank" rel="noreferrer" className="album-list-item">
            <div className="album-list-img-wrap">
              {album.image ? (
                <Image src={album.image} alt={album.name} width={48} height={48} quality={85} sizes="48px" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="album-list-placeholder">💿</div>
              )}
            </div>
            <div className="album-info" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div className="album-name" style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={album.name}>{album.name}</div>
              <div className="album-meta" style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span className="album-type-badge" style={{ textTransform: 'capitalize' }}>{album.type}</span>
                <span className="album-date">{album.releaseDate ? new Date(album.releaseDate).getFullYear() : ''}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

export function TopTracksList({ tracks, artistName }: { tracks: LastfmTrack[]; artistName: string }) {
  const [playingTrack, setPlayingTrack] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = (trackUrl: string) => {
    if (playingTrack === trackUrl) {
      audioRef.current?.pause()
      setPlayingTrack(null)
    } else {
      if (audioRef.current) {
        audioRef.current.src = trackUrl
        audioRef.current.play()
      }
      setPlayingTrack(trackUrl)
    }
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <h2 className="section-title" style={{ marginBottom: 16 }}>Top Tracks</h2>
      <audio ref={audioRef} onEnded={() => setPlayingTrack(null)} />
      <ul className="track-list" id="top-tracks-list">
        {tracks.map((t, i) => {
          const trackUrl = t.url || `https://open.spotify.com/search/${encodeURIComponent(artistName + ' ' + t.name)}`
          const isPlaying = playingTrack === t.previewUrl
          
          return (
            <li key={t.name + i} className="track-item" style={{ padding: '12px 0' }}>
              <span className="track-num" style={{ width: 24 }}>{i + 1}</span>
              
              {t.previewUrl && (
                <button 
                  onClick={() => togglePlay(t.previewUrl!)}
                  style={{ 
                    background: isPlaying ? 'var(--accent)' : 'var(--bg-card)', 
                    border: '1px solid var(--border)', 
                    color: isPlaying ? '#fff' : 'var(--text-primary)',
                    borderRadius: '50%', 
                    width: 32, 
                    height: 32, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    marginRight: 12,
                    transition: 'all 200ms ease'
                  }}
                  title="Play 30s preview"
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
              )}
              
              <div className="track-info" style={{ flex: 1 }}>
                <a href={trackUrl} target="_blank" rel="noreferrer" className="track-name" style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem' }}>
                  {t.name}
                  <SpotifyIcon size={12} />
                </a>
              </div>
              
              {t.playcount > 0 && (
                <span className="track-plays" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatPlaycount(t.playcount)}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function UpcomingShowsList({ artistName }: { artistName: string }) {
  const raSearchUrl = `https://ra.co/search?q=${encodeURIComponent(artistName)}`
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 className="section-title" style={{ marginBottom: 16 }}>
        Upcoming Shows
      </h2>
      <div style={{
        padding: '24px',
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px dashed var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12
      }}>
        <div style={{ fontSize: '2rem' }}>🗓️</div>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem' }}>Find {artistName}'s next gig</h3>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Check out Resident Advisor for their full tour schedule and tickets.
          </p>
        </div>
        <a 
          href={raSearchUrl} 
          target="_blank" 
          rel="noreferrer"
          className="btn btn-secondary"
          style={{ marginTop: 8, textDecoration: 'none' }}
        >
          View on Resident Advisor
        </a>
      </div>
    </div>
  )
}
