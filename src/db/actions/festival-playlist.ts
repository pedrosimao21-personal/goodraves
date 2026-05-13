"use server";

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

/**
 * Normalize a string for comparison: lowercase, remove special chars, trim.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

/**
 * Check if the playlist name contains the festival name (exact match).
 * Simple and reliable - if the festival name appears in the playlist, it's a match.
 */
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

/**
 * Find a Spotify playlist for a festival using a simple two-step strategy:
 *
 * 1. Search for the sanitized festival name — accept if playlist name contains it.
 * 2. If no match, fall back to "This is {headliner}" playlist.
 *
 * This simplified approach favors returning a playlist over being too strict.
 */
export async function getFestivalPlaylist(
  festivalName: string,
  headlinerName?: string
): Promise<FestivalPlaylistData | null> {
  if (!festivalName) return null;

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
