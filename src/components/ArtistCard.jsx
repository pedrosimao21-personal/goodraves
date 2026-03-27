import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserData } from '../context/UserDataContext'
import { searchArtist, HAS_SPOTIFY } from '../api/spotify'
import StarRating from './StarRating'

export default function ArtistCard({ artist, eventId }) {
  const navigate = useNavigate()
  const { didSeeArtist, toggleSawArtist, getPerformanceRating } = useUserData()
  const saw = didSeeArtist(eventId, artist.id)
  
  // Now fetching the per-festival performance rating
  const rating = getPerformanceRating(eventId, artist.id)

  // Lazy-fetch Spotify image for artists without images (e.g. EDMTrain)
  const [spotifyImage, setSpotifyImage] = useState(null)
  const [spotifyUrl, setSpotifyUrl] = useState(null)

  useEffect(() => {
    if (artist.image || !HAS_SPOTIFY) return
    let cancelled = false
    searchArtist(artist.name)
      .then(sp => {
        if (!cancelled && sp?.image) {
          setSpotifyImage(sp.image)
          setSpotifyUrl(sp.url)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [artist.name, artist.image])

  const displayImage = artist.image || spotifyImage
  const hasSpotifyEnhanced = !artist.image && spotifyImage

  const handleToggle = (e) => {
    e.stopPropagation()
    toggleSawArtist(eventId, artist.id, { name: artist.name, image: displayImage })
  }

  const handleClick = () => {
    navigate(`/artist/${encodeURIComponent(artist.name)}?id=${artist.id}`)
  }

  return (
    <div className="artist-card fade-in" id={`artist-${artist.id}`}>
      <div onClick={handleClick} style={{ cursor: 'pointer', display: 'contents' }}>
        {displayImage ? (
          <div style={{ position: 'relative' }}>
            <img className="artist-avatar" src={displayImage} alt={artist.name} loading="lazy" />
            {hasSpotifyEnhanced && (
              <span className="spotify-badge" title="Image from Spotify">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#1DB954">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </span>
            )}
          </div>
        ) : (
          <div className="artist-avatar-placeholder">🎤</div>
        )}
        <div className="artist-name">{artist.name}</div>
      </div>

      {saw && (
        <div onClick={(e) => { e.stopPropagation() }} style={{ marginTop: 8 }}>
          <StarRating artistId={artist.id} eventId={eventId} readonly={false} size="sm" />
        </div>
      )}

      <button
        className={`artist-saw-toggle ${saw ? 'saw' : ''}`}
        onClick={handleToggle}
        id={`saw-${artist.id}`}
        style={{ marginTop: 8 }}
      >
        {saw ? '✓ I saw them!' : 'Mark as seen'}
      </button>
    </div>
  )
}
