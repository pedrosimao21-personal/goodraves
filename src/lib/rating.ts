/**
 * Artist/set ratings run from 0.5 to 5 in half points (0 = not rated). The
 * rating meter draws one bar per half point, so ten bars cover the range.
 * Festival "vibe" ratings are separate and stay whole numbers (see
 * MIN_RATING/MAX_RATING in constants.ts).
 */
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;
export const RATING_BAR_COUNT = RATING_MAX / RATING_STEP;
const SPECTRUM_GREEN_HUE = 110;

/** Nearest half point, clamped to 0..RATING_MAX. */
export function snapRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(RATING_MAX, Math.round(value / RATING_STEP) * RATING_STEP));
}

/** "4" for 4, "4.5" for 4.5. */
export function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Server-side check for a rating about to be stored: snaps to a half point, rejects anything outside 0.5..5. */
export function validateArtistRating(rating: number): number {
  const snapped = snapRating(rating);
  if (!Number.isFinite(rating) || snapped < RATING_STEP) {
    throw new Error(`Rating must be between ${RATING_STEP} and ${RATING_MAX}`);
  }
  return snapped;
}

/** Colour of meter bar `index` (0 = shortest): green through yellow and orange to red. */
export function ratingBarColor(index: number): string {
  const hue = Math.round(SPECTRUM_GREEN_HUE - (SPECTRUM_GREEN_HUE * index) / (RATING_BAR_COUNT - 1));
  return `hsl(${hue} 78% 52%)`;
}
