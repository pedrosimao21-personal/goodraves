"use server";

import { enforceRateLimit } from "./festival-helpers";
import { RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { getFestivalPlaylistCore, type FestivalPlaylistData } from "./festival-playlist-core";

export type { FestivalPlaylistData };

/**
 * Find a Spotify playlist for a festival — see festival-playlist-core.ts for
 * the matching strategy and caching.
 *
 * This is the rate-limited Server Action, for FestivalDetailClient's own
 * client-side call (its fallback when a server-rendered initialPlaylist
 * wasn't provided). festival/[id]/page.tsx's server-side prefetch calls
 * getFestivalPlaylistCore directly instead: enforceRateLimit reads
 * headers(), and Next.js disallows that anywhere in a request that also
 * uses festival-timetable.ts's unstable_cache call — which page.tsx also
 * awaits, in the same Promise.all.
 */
export async function getFestivalPlaylist(
  festivalName: string,
  headlinerName?: string
): Promise<FestivalPlaylistData | null> {
  if (!festivalName) return null;
  await enforceRateLimit("playlist", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);
  return getFestivalPlaylistCore(festivalName, headlinerName);
}
