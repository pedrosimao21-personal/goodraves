'use client'

import { memo } from 'react'
import { useUserDataActions } from '../context/UserDataContext'
import RatingInput from './rating/RatingInput'
import RatingSquares from './rating/RatingSquares'

/**
 * A user's rating of an artist: per set when `eventId` is given (a festival
 * performance), otherwise their global rating. Renders the rating squares.
 */
export default memo(function StarRating({ artistId, eventId, readonly = false, size = 'md', artistName }: {
  artistId: string
  eventId?: string
  readonly?: boolean
  size?: 'sm' | 'md'
  artistName?: string
}) {
  const { getRating, setRating, getPerformanceRating, setPerformanceRating } = useUserDataActions()
  const current = eventId ? getPerformanceRating(eventId, artistId) : getRating(artistId)

  if (readonly) return <RatingSquares value={current} size={size} />

  const handleChange = (rating: number) => {
    if (eventId) setPerformanceRating(eventId, artistId, rating)
    else setRating(artistId, rating)
  }

  return (
    <RatingInput
      value={current}
      onChange={handleChange}
      label={artistName ? `Rate ${artistName}` : 'Artist rating'}
      idPrefix={`star-${artistId}`}
    />
  )
})
