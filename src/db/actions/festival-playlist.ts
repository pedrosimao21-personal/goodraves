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

const SIMILARITY_THRESHOLD = 0.6;
const SEARCH_CANDIDATE_LIMIT = 5;

/**
 * Compute a simple normalized string similarity score between 0 and 1.
 * Uses character-level bigram overlap (Dice coefficient).
 */
function computeSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const buildBigrams = (s: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) bigrams.add(s.slice(i, i + 2));
    return bigrams;
  };

  const bigramsA = buildBigrams(na);
  const bigramsB = buildBigrams(nb);

  let intersectionCount = 0;
  bigramsA.forEach((bigram) => { if (bigramsB.has(bigram)) intersectionCount++; });

  return (2 * intersectionCount) / (bigramsA.size + bigramsB.size);
}

/**
 * Strip year, edition markers, and common suffixes to get a clean festival name.
 * e.g. "Awakenings Festival 2024 - Day 1" → "Awakenings Festival"
 */
function sanitizeFestivalName(name: string): string {
  return name
    .replace(/\b20\d{2}\b/g, "")          // Remove years like 2024
    .replace(/[-–—].*$/g, "")             // Remove everything after a dash
    .replace(/\b(day|night|edition|vol|volume|pres\.?|presents)\b.*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extract the most likely headliner name from a festival name string.
 * Handles patterns like "Funk Tribu pres. TRIBE" → "Funk Tribu"
 */
function extractHeadliner(festivalName: string): string | null {
  const presMatch = festivalName.match(/^(.+?)\s+(?:pres\.?|presents)/i);
  if (presMatch) return presMatch[1].trim();
  return null;
}

/**
 * Find a Spotify playlist for a festival using a smart multi-step strategy:
 *
 * 1. Search for the sanitized festival name and check for a close match.
 * 2. If no close match found and a headliner is provided, try "This is {headliner}".
 * 3. If still nothing, try extracting a headliner from the festival name itself.
 */
export async function getFestivalPlaylist(
  festivalName: string,
  headlinerName?: string
): Promise<FestivalPlaylistData | null> {
  if (!festivalName) return null;

  try {
    const sanitizedName = sanitizeFestivalName(festivalName);

    // Step 1: Search for festival playlist by sanitized name
    const candidates = await spotifySearchPlaylist(sanitizedName, SEARCH_CANDIDATE_LIMIT);

    if (candidates.length > 0) {
      // Prefer exact or close name match
      const closeMatch = candidates.find(
        (p) => computeSimilarity(p.name, sanitizedName) >= SIMILARITY_THRESHOLD
      );
      if (closeMatch) return closeMatch;
    }

    // Step 2: Fall back to "This is {headliner}" — either passed explicitly or extracted
    const resolvedHeadliner =
      headlinerName ?? extractHeadliner(festivalName);

    if (resolvedHeadliner) {
      const thisIsQuery = `This is ${resolvedHeadliner}`;
      const thisIsResults = await spotifySearchPlaylist(thisIsQuery, SEARCH_CANDIDATE_LIMIT);

      // Only accept if the result looks like Spotify's official "This is" playlist
      const thisIsMatch = thisIsResults.find(
        (p) =>
          p.name.toLowerCase().startsWith("this is") &&
          computeSimilarity(p.name, thisIsQuery) >= SIMILARITY_THRESHOLD
      );
      if (thisIsMatch) return thisIsMatch;
    }

    // Step 3: Return the first candidate from the initial search as a last resort
    if (candidates.length > 0) return candidates[0];
  } catch (err) {
    console.error("[festival-playlist] Error searching playlist:", err);
  }

  return null;
}
