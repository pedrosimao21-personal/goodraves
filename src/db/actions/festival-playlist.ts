"use server";

import { enforceRateLimit } from "./festival-helpers";
import { RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS, MAX_FESTIVAL_NAME_LENGTH } from "@/lib/constants";
import { getFestivalPlaylistCore, type FestivalPlaylistData } from "./festival-playlist-core";

export type { FestivalPlaylistData };

const MAX_CLIENT_LINEUP_NAMES = 100;

/**
 * Find a Spotify playlist for a festival — see festival-playlist-core.ts for
 * the matching strategy and caching.
 *
 * This is the rate-limited Server Action, for FestivalDetailClient's own
 * client-side call (custom festivals, which the server doesn't look up).
 * festival/[id]/page.tsx's server-side prefetch calls
 * getFestivalPlaylistCore directly instead: enforceRateLimit reads
 * headers(), and Next.js disallows that anywhere in a request that also
 * uses festival-timetable.ts's unstable_cache call — which page.tsx also
 * awaits, in the same Promise.all.
 */
export async function getFestivalPlaylist(
  festivalName: string,
  lineupNames: string[] = []
): Promise<FestivalPlaylistData | null> {
  if (!festivalName || typeof festivalName !== "string") return null;
  await enforceRateLimit("playlist", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);
  // Client-supplied: keep only plain strings, and not an unbounded number.
  const names = Array.isArray(lineupNames)
    ? lineupNames.filter((n): n is string => typeof n === "string").slice(0, MAX_CLIENT_LINEUP_NAMES)
    : [];
  return getFestivalPlaylistCore(festivalName.slice(0, MAX_FESTIVAL_NAME_LENGTH), names);
}
