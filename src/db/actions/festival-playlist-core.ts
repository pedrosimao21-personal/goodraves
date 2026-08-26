import { unstable_cache } from "next/cache";
import { spotifySearchPlaylist } from "@/services/spotify/client";

export type FestivalPlaylistData = {
  id: string;
  name: string;
  description: string;
  url: string | null;
  image: string | null;
  owner: string;
  tracksTotal: number;
};

const SEARCH_CANDIDATE_LIMIT = 5;
const PLAYLIST_CACHE_REVALIDATE_SECONDS = 24 * 60 * 60;

/**
 * Deliberately no "use server" — see festival-import-ra-core.ts's file
 * comment for the general reasoning. festival/[id]/page.tsx's server-side
 * prefetch calls getFestivalPlaylistCore directly (no rate limiting, no
 * headers() reachable) so it can safely run in the same request as
 * festival-timetable.ts's unstable_cache call; the rate-limited action
 * wrapper (festival-playlist.ts) is for FestivalDetailClient's own
 * client-side fallback call.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function isExactMatch(playlistName: string, festivalName: string): boolean {
  const normalizedPlaylist = normalize(playlistName);
  const normalizedFestival = normalize(festivalName);
  return normalizedPlaylist.includes(normalizedFestival);
}

/**
 * Strip year, edition markers, and common suffixes to get a clean festival name.
 * e.g. "Awakenings Festival 2024 - Day 1" → "Awakenings Festival"
 */
function sanitizeFestivalName(name: string): string {
  return name
    .replace(/\b20\d{2}\b/g, "")
    .replace(/[-–—].*$/g, "")
    .replace(/\b(day|night|edition|vol|volume|pres\.?|presents)\b.*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchFestivalPlaylist(
  festivalName: string,
  headlinerName?: string
): Promise<FestivalPlaylistData | null> {
  try {
    const sanitizedName = sanitizeFestivalName(festivalName);

    // Step 1: Search by sanitized festival name, accept if it contains the name
    const candidates = await spotifySearchPlaylist(
      sanitizedName,
      SEARCH_CANDIDATE_LIMIT
    );

    const exactMatch = candidates.find((p) =>
      isExactMatch(p.name, sanitizedName)
    );
    if (exactMatch) return exactMatch;

    // Step 2: Always fall back to "This is {headliner}" if we have a headliner
    if (headlinerName) {
      const thisIsQuery = `This is ${headlinerName}`;
      const thisIsResults = await spotifySearchPlaylist(
        thisIsQuery,
        SEARCH_CANDIDATE_LIMIT
      );

      const thisIsMatch = thisIsResults.find((p) =>
        p.name.toLowerCase().startsWith("this is")
      );
      if (thisIsMatch) return thisIsMatch;
    }
  } catch (err) {
    console.error("[festival-playlist] Error searching playlist:", err);
  }

  return null;
}

const getCachedFestivalPlaylist = unstable_cache(
  async (festivalName: string, headlinerName: string): Promise<FestivalPlaylistData | null> =>
    fetchFestivalPlaylist(festivalName, headlinerName || undefined),
  ["festival-playlist"],
  { revalidate: PLAYLIST_CACHE_REVALIDATE_SECONDS }
);

/**
 * Find a Spotify playlist for a festival using a simple two-step strategy:
 *
 * 1. Search for the sanitized festival name — accept if playlist name contains it.
 * 2. If no match, fall back to "This is {headliner}" playlist.
 *
 * This simplified approach favors returning a playlist over being too strict.
 *
 * Public, non-user-specific data (same result for every viewer of a given
 * festival), so it's cached for a day — this was previously a live Spotify
 * search on every single festival-page view.
 */
export async function getFestivalPlaylistCore(
  festivalName: string,
  headlinerName?: string
): Promise<FestivalPlaylistData | null> {
  if (!festivalName) return null;
  return getCachedFestivalPlaylist(festivalName, headlinerName ?? "");
}
