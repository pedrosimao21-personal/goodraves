import { memberRatingFromSets } from '@/lib/b2b-rating'
import type { UserDataState } from './user-data-state'

/**
 * The instant, on-screen effect of rating a B2B set (0 clears it), before the server answers.
 * The set keeps its own rating. Each member's rating for the festival is then re-worked from the
 * rated sets they are in, the same way the server does it (rate-b2b-set.ts): so a member who is
 * also in another rated set keeps a rating, and one left with none goes back to unseen.
 */
export function applyB2bSetRating(prev: UserDataState, b2bSetId: string, rating: number): UserDataState {
  const b2bSet = Object.values(prev.b2bSets).flat().find(s => s.id === b2bSetId)
  if (!b2bSet) return prev

  const b2bSetRatings = { ...prev.b2bSetRatings }
  if (rating > 0) b2bSetRatings[b2bSetId] = rating
  else delete b2bSetRatings[b2bSetId]

  const festivalSets = prev.b2bSets[b2bSet.festivalId] ?? []
  const performanceRatings = { ...prev.performanceRatings }
  let seen = [...(prev.seenArtists[b2bSet.festivalId] ?? [])]

  for (const member of b2bSet.members) {
    const setRatings = festivalSets
      .filter(s => s.members.some(m => m.artistId === member.artistId))
      .map(s => b2bSetRatings[s.id] ?? 0)
    const memberRating = memberRatingFromSets(setRatings)
    const key = `${b2bSet.festivalId}::${member.artistId}`

    if (memberRating === null) {
      delete performanceRatings[key]
      seen = seen.filter(id => id !== member.artistId)
    } else {
      performanceRatings[key] = memberRating
      if (!seen.includes(member.artistId)) seen.push(member.artistId)
    }
  }

  return {
    ...prev,
    b2bSetRatings,
    performanceRatings,
    seenArtists: { ...prev.seenArtists, [b2bSet.festivalId]: seen },
  }
}
