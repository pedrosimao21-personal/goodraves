import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserData } from '../context/UserDataContext'
import { searchArtist, HAS_SPOTIFY } from '../api/spotify'
import { getWikiImage } from '../api/wikipedia'

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return 'Date TBA'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FestivalCard({ event }) {
  const navigate = useNavigate()
  const { isAttended, isUpcoming, toggleAttended, toggleUpcoming, getSeenCount } = useUserData()
  
  const attended = isAttended(event.id)
  const upcoming = isUpcoming(event.id)
  const seenCount = getSeenCount(event.id)

  const isEdmtrain = event.source === 'edmtrain'
  const artistCount = event.attractions?.length ?? 0
  
  // Check if event is in the future
  const isFuture = event.date && new Date(event.date + 'T00:00:00') > new Date()

  // Spotify image fallback for events without images
  const [fallbackImage, setFallbackImage] = useState(null)
  
  useEffect(() => {
    if (event.image) return
    let cancelled = false
    
    const fetchWikiFallback = async () => {
      if (cancelled) return
      let img = null
      // Try venue name first
      if (event.venue?.name) {
        try { img = await getWikiImage(event.venue.name) } catch (e) {}
      }
      // If no venue image found, try city name
      if (!img && event.venue?.city) {
        try { img = await getWikiImage(event.venue.city) } catch (e) {}
      }
      if (!cancelled && img) setFallbackImage(img)
    }

    if (HAS_SPOTIFY && artistCount > 0) {
      const mainArtist = event.attractions[0].name
      searchArtist(mainArtist)
        .then(sp => {
          if (!cancelled) {
            if (sp?.image) setFallbackImage(sp.image)
            else fetchWikiFallback()
          }
        })
        .catch(() => { if (!cancelled) fetchWikiFallback() })
    } else {
      fetchWikiFallback()
    }

    return () => { cancelled = true }
  }, [event.image, artistCount, event.attractions, event.venue?.city])

  const displayImage = event.image || fallbackImage

  const handleAction = (e) => {
    e.stopPropagation()
    const payload = {
      name: event.name,
      date: event.date,
      venue: event.venue,
      image: displayImage,
      genre: event.genre,
      source: event.source,
    }
    if (isFuture) {
      toggleUpcoming(event.id, payload)
    } else {
      toggleAttended(event.id, payload)
    }
  }

  const handleClick = () => {
    navigate(`/festival/${event.id}`, { state: { event: { ...event, image: displayImage } } })
  }

  const isActive = isFuture ? upcoming : attended
  const actionLabelText = isFuture 
    ? (upcoming ? 'Going ✓' : 'Mark as Going')
    : (attended ? 'Attended ✓' : 'Mark as Attended')

  return (
    <div className="festival-card fade-in" onClick={handleClick}>
      {displayImage ? (
        <img className="festival-card-img" src={displayImage} alt={event.name} loading="lazy" />
      ) : (
        <div className="festival-card-img-placeholder">
          {isEdmtrain ? '⚡' : '🎪'}
        </div>
      )}

      <div className="festival-card-body">
        <div className="festival-card-tags">
          {isEdmtrain && <span className="tag tag-edm">⚡ EDMTrain</span>}
          {!isEdmtrain && event.source === 'ticketmaster' && <span className="tag tag-tm">🎫 TM</span>}
          {event.genre && <span className="tag">{event.genre}</span>}
          {event.subGenre && event.subGenre !== event.genre && (
            <span className="tag tag-orange">{event.subGenre}</span>
          )}
          {event.ages && <span className="tag tag-purple">{event.ages}</span>}
          {attended && <span className="tag tag-green">✓ Attended</span>}
          {upcoming && <span className="tag" style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>✓ Going</span>}
        </div>

        <h3 className="festival-card-title">{event.name}</h3>

        <div className="festival-card-meta">
          <div className="festival-card-meta-item">
            <CalendarIcon />
            {formatDate(event.date)}
          </div>
          {event.venue?.name && (
            <div className="festival-card-meta-item">
              <MapPinIcon />
              {event.venue.name}{event.venue.city ? `, ${event.venue.city}` : ''}
            </div>
          )}
        </div>

        {artistCount > 0 && (
          <div className="festival-card-artists">
            🎤 {artistCount} artist{artistCount !== 1 ? 's' : ''} in lineup
          </div>
        )}
      </div>

      <div className="festival-card-footer">
        <button 
          className={`attend-btn ${isActive ? 'attended' : ''}`} 
          onClick={handleAction} 
          id={`action-${event.id}`}
          style={isFuture && upcoming ? { background: '#3b82f6', borderColor: '#3b82f6', color: '#fff' } : {}}
        >
          <CheckIcon />
          <span className="attend-label">{actionLabelText}</span>
        </button>
        {attended && seenCount > 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {seenCount} artist{seenCount !== 1 ? 's' : ''} seen
          </span>
        )}
      </div>
    </div>
  )
}
