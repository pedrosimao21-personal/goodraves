"use server";

/**
 * Fallback image lookup for festival cards that have no image of their own.
 * Tries the main artist's Spotify image first, then a Wikipedia thumbnail for
 * the venue, then the city — returning the first hit (or null).
 *
 * This is the single gated entry point for what used to be direct client-side
 * calls to the Spotify and Wikipedia transport clients. Those clients are now
 * server-only modules (no longer `"use server"`), so this action is the only
 * way a browser can reach them, and it is rate limited.
 */

import { spotifySearchArtist } from "@/services/spotify/client";
import { getWikiImage } from "@/services/wikipedia/client";
import { enforceRateLimit } from "./festival-helpers";
import { MAX_QUERY_LENGTH, RATE_LIMIT_IMAGE_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export type FestivalCardImageInput = {
  mainArtist?: string | null;
  venueName?: string | null;
  city?: string | null;
};

/** Keep only a non-empty string within the query length cap (names are far shorter). */
function cleanTerm(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) return null;
  return trimmed;
}

async function findWikiImage(venueName?: string | null, city?: string | null): Promise<string | null> {
  if (venueName) {
    const venueImage = await getWikiImage(venueName).catch(() => null);
    if (venueImage) return venueImage;
  }
  if (city) {
    return getWikiImage(city).catch(() => null);
  }
  return null;
}

export async function getFestivalCardImage(
  input: FestivalCardImageInput
): Promise<string | null> {
  const mainArtist = cleanTerm(input.mainArtist);
  const venueName = cleanTerm(input.venueName);
  const city = cleanTerm(input.city);

  // Nothing to look up — skip the rate-limit write and RPC work entirely so a
  // card with no artist/venue/city costs nothing.
  if (!mainArtist && !venueName && !city) return null;

  await enforceRateLimit("card-image", RATE_LIMIT_IMAGE_MAX, RATE_LIMIT_WINDOW_MS);

  if (mainArtist) {
    const spotify = await spotifySearchArtist(mainArtist).catch(() => null);
    if (spotify?.image) return spotify.image;
  }
  return findWikiImage(venueName, city);
}
