import { useState } from 'react'
import { useUserData } from '../context/UserDataContext'

export default function StarRating({ artistId, eventId, readonly = false, size = 'md' }) {
  const { getRating, setRating, getPerformanceRating, setPerformanceRating } = useUserData()
  const [hover, setHover] = useState(0)
  
  // Use performance rating if eventId is provided, else use global rating
  const current = eventId ? getPerformanceRating(eventId, artistId) : getRating(artistId)

  const stars = [1, 2, 3, 4, 5]
  const fontSize = size === 'sm' ? '0.9rem' : '1.3rem'

  const handleClick = (star) => {
    if (readonly) return
    const newRating = star === current ? 0 : star
    if (eventId) {
      setPerformanceRating(eventId, artistId, newRating)
    } else {
      setRating(artistId, newRating)
    }
  }

  return (
    <div className="star-rating" role="group" aria-label="Artist rating">
      {stars.map((star) => (
        <span
          key={star}
          className={`star ${readonly ? 'star-static' : ''} ${(hover || current) >= star ? 'filled' : ''}`}
          style={{ fontSize }}
          onClick={() => handleClick(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          role={readonly ? undefined : 'button'}
          aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
          id={readonly ? undefined : `star-${artistId}-${star}`}
        >
          ★
        </span>
      ))}
    </div>
  )
}
