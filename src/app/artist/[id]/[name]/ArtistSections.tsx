'use client'

import Image from 'next/image'
import { type ArtistData } from '@/db/actions/artists'
import StarRating from '@/components/StarRating'
import { ResidentAdvisorIcon, SpotifyIcon } from '@/components/icons'
import { formatFollowers, formatPlaycount } from './format-counts'

import { MAX_NOTES_LENGTH } from '@/lib/constants'

type SpotifyAlbum = { id: string; name: string; releaseDate: string; image: string | null; url: string | null; type: string }
type LastfmTrack = { name: string; playcount: number; url: string | null; listeners: number }

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
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 className="section-title" style={{ marginBottom: 16 }}>Top Tracks</h2>
      <ul className="track-list" id="top-tracks-list">
        {tracks.map((t, i) => {
          const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(artistName + ' ' + t.name)}`
          return (
            <li key={t.name + i} className="track-item">
              <span className="track-num">{i + 1}</span>
              <div className="track-info">
                <a href={spotifySearchUrl} target="_blank" rel="noreferrer" className="track-name" style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t.name}
                  <SpotifyIcon size={12} />
                </a>
              </div>
              {t.playcount > 0 && (
                <span className="track-plays">{formatPlaycount(t.playcount)}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type ArtistShow = { id: string; name: string; publisher: string; image: string | null; url: string | null; description: string }

export function UpcomingShowsList({ shows }: { shows: ArtistShow[] }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 className="section-title" style={{ marginBottom: 4 }}>
        Upcoming Shows
        <span className="spotify-badge-inline"><SpotifyIcon size={13} /></span>
      </h2>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        DJ sets &amp; mixes on Spotify
      </p>
      {shows.length === 0 ? (
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          No upcoming shows found on Spotify.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shows.map(show => (
            <a
              key={show.id}
              href={show.url ?? '#'}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 200ms ease, background 200ms ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              {show.image ? (
                <Image
                  src={show.image}
                  alt={show.name}
                  width={48}
                  height={48}
                  sizes="48px"
                  quality={85}
                  style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--gradient-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🎙️</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{show.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{show.publisher}</div>
              </div>
              <SpotifyIcon size={16} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
