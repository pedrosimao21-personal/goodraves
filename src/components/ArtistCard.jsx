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
  const [spotifyGenres, setSpotifyGenres] = useState([])

  useEffect(() => {
    if (artist.image || !HAS_SPOTIFY) return
    let cancelled = false
    searchArtist(artist.name)
      .then(sp => {
        if (!cancelled) {
          if (sp?.image) setSpotifyImage(sp.image)
          if (sp?.url) setSpotifyUrl(sp.url)
          if (sp?.genres) setSpotifyGenres(sp.genres)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [artist.name, artist.image])

  const displayImage = artist.image || spotifyImage
  const hasSpotifyEnhanced = !artist.image && spotifyImage

  const handleToggle = (e) => {
    e.stopPropagation()
    toggleSawArtist(eventId, artist.id, { 
      name: artist.name, 
      image: displayImage,
      genres: artist.genres || spotifyGenres 
    })
  }

  const handleClick = () => {
    navigate(`/artist/${encodeURIComponent(artist.name)}?id=${artist.id}`)
  }

  return (
    <div className="artist-card fade-in" id={`artist-${artist.id}`}>
      <div onClick={handleClick} style={{ cursor: 'pointer', display: 'contents' }}>
        {displayImage ? (
            <img className="artist-avatar" src={displayImage} alt={artist.name} loading="lazy" />
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
