import { sql } from "drizzle-orm";
import { artists } from "@/db/schema";
import { foldArtistName } from "@/lib/lineup-name";

/**
 * Rules for who may set an artist's photo: an admin's (locked) photo and an RA
 * profile photo are never replaced by a Spotify lookup. Spotify only fills in
 * or refreshes a photo it provided itself.
 */

type PhotoState = { imageSource: string | null; imageLocked: boolean };

/** Whether a Spotify lookup may replace this artist's current photo. */
export function canSpotifyReplacePhoto(row: PhotoState): boolean {
  return !row.imageLocked && row.imageSource !== "ra";
}

/** The photo columns for a Spotify result on an artist where Spotify may set it. */
export function spotifyPhotoFields(image: string | null | undefined) {
  return { imageUrl: image ?? null, imageSource: image ? "spotify" : null };
}

/**
 * `ON CONFLICT DO UPDATE SET` expressions for batch upserts of Spotify results:
 * the stored photo stays when it is RA's or locked, otherwise the Spotify one
 * (or none) replaces it and the source follows.
 */
export const SPOTIFY_UPSERT_IMAGE = {
  imageUrl: sql`CASE WHEN ${artists.imageLocked} OR ${artists.imageSource} = 'ra' THEN ${artists.imageUrl} ELSE excluded.image_url END`,
  imageSource: sql`CASE WHEN ${artists.imageLocked} OR ${artists.imageSource} = 'ra' THEN ${artists.imageSource} WHEN excluded.image_url IS NOT NULL THEN 'spotify' ELSE NULL END`,
};

/**
 * Photo columns to store when RA's slug lookup (made for the artist page)
 * returned a profile photo: only if the profile's name is ours and the photo
 * isn't locked. Empty when there is nothing to change.
 */
export function raPhotoFieldsFromLookup(
  row: { name: string; imageLocked: boolean },
  ra: { raArtistId: string | null; name: string | null; imageUrl: string | null } | null,
  now: Date
) {
  if (!ra?.imageUrl || !ra.raArtistId || row.imageLocked) return {};
  if (!ra.name || foldArtistName(ra.name) !== foldArtistName(row.name)) return {};
  return { imageUrl: ra.imageUrl, imageSource: "ra", raPhotoCheckedAt: now };
}
