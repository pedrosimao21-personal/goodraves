import { unstable_cache } from "next/cache";
import { spotifySearchPlaylist, spotifyGetPlaylistArtistNames } from "@/services/spotify/client";
import { brandKey, nameContainsBrand, isOwnedByBrand, isLineupConfirmed, rankCandidates } from "@/lib/playlist-match";

export type FestivalPlaylistData = {
  id: string;
  name: string;
  description: string;
  url: string | null;
  image: string | null;
  owner: string;
  tracksTotal: number;
};

type SearchResult = Awaited<ReturnType<typeof spotifySearchPlaylist>>[number];

const SEARCH_CANDIDATE_LIMIT = 10;
/** Playlists whose contents we read to check them against the lineup (one Spotify call each). */
const MAX_LINEUP_CHECKS = 3;
/** Enough of the lineup to recognise the festival; keeps the cache key bounded. */
const MAX_LINEUP_NAMES = 100;
const PLAYLIST_CACHE_REVALIDATE_SECONDS = 24 * 60 * 60;

/**
 * Deliberately no "use server" — see festival-import-ra-core.ts's file
 * comment for the general reasoning. festival/[id]/page.tsx's server-side
 * prefetch calls getFestivalPlaylistCore directly (no rate limiting, no
 * headers() reachable) so it can safely run in the same request as
 * festival-timetable.ts's unstable_cache call; the rate-limited action
 * wrapper (festival-playlist.ts) is for FestivalDetailClient's own
 * client-side call for custom festivals.
 */

/**
 * Strip year, edition markers, and common suffixes to get a clean search query.
 * e.g. "Awakenings Festival 2024 - Day 1" → "Awakenings Festival"
 */
function sanitizeFestivalName(name: string): string {
  return name
    .replace(/\b20\d{2}\b/g, "")
    .replace(/[-–—:].*$/g, "")
    .replace(/\b(day|night|edition|vol|volume|pres\.?|presents|with)\b.*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toPlaylistData(p: SearchResult): FestivalPlaylistData {
  return { id: p.id, name: p.name, description: p.description, url: p.url, image: p.image, owner: p.owner, tracksTotal: p.tracksTotal };
}

/**
 * Only returns a playlist it can vouch for — see lib/playlist-match.ts:
 *  1. named after the festival AND published by the festival's own account, or
 *  2. named after the festival AND containing a real part of its lineup.
 * Otherwise null, and the festival page simply shows no playlist. There is
 * deliberately no "This is {headliner}" fallback any more: that's an artist's
 * playlist, not the festival's, and was the main source of wrong matches.
 */
async function fetchFestivalPlaylist(festivalName: string, lineupNames: string[]): Promise<FestivalPlaylistData | null> {
  const brand = brandKey(festivalName);
  if (!brand) return null;

  const results = await spotifySearchPlaylist(sanitizeFestivalName(festivalName), SEARCH_CANDIDATE_LIMIT);
  const named = rankCandidates(results.filter((p: SearchResult) => nameContainsBrand(p.name, brand)), festivalName) as SearchResult[];

  const official = named.find((p) => isOwnedByBrand(p, brand));
  if (official) return toPlaylistData(official);

  for (const candidate of named.slice(0, MAX_LINEUP_CHECKS)) {
    const artists = await spotifyGetPlaylistArtistNames(candidate.id);
    // null = Spotify won't let us read playlist contents; nothing more to check.
    if (artists === null) return null;
    if (isLineupConfirmed(lineupNames, artists)) return toPlaylistData(candidate);
  }
  return null;
}

// "-v2" so results cached by the old, looser matcher aren't served for another day.
const getCachedFestivalPlaylist = unstable_cache(
  async (festivalName: string, lineupNames: string[]): Promise<FestivalPlaylistData | null> =>
    fetchFestivalPlaylist(festivalName, lineupNames),
  ["festival-playlist-v2"],
  { revalidate: PLAYLIST_CACHE_REVALIDATE_SECONDS }
);

/**
 * The festival's own Spotify playlist, or null if none can be confidently
 * identified. Public, non-user-specific data (same result for every viewer of
 * a given festival), so it's cached for a day. A Spotify failure (e.g. the
 * app's quota is exhausted) throws rather than caching a "no playlist" result.
 */
export async function getFestivalPlaylistCore(
  festivalName: string,
  lineupNames: string[] = []
): Promise<FestivalPlaylistData | null> {
  if (!festivalName) return null;
  return getCachedFestivalPlaylist(festivalName, lineupNames.slice(0, MAX_LINEUP_NAMES));
}
