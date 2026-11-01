/**
 * An artist can play several B2B sets at one festival, and each set is rated on its own. The
 * artist's own rating for that festival is the average of the sets they were rated in, in half
 * points like every rating. Null when none of their sets is rated. Used by the server action and
 * the optimistic client update, so both agree.
 */
const HALF_POINTS_PER_POINT = 2;

export function memberRatingFromSets(setRatings: number[]): number | null {
  const rated = setRatings.filter((rating) => rating > 0);
  if (rated.length === 0) return null;
  const average = rated.reduce((sum, rating) => sum + rating, 0) / rated.length;
  return Math.round(average * HALF_POINTS_PER_POINT) / HALF_POINTS_PER_POINT;
}
