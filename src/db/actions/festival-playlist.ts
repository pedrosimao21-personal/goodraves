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

const SIMILARITY_THRESHOLD = 0.75;
const WORD_OVERLAP_RATIO = 0.7;
const MIN_WORD_LENGTH = 2;
const SEARCH_CANDIDATE_LIMIT = 5;

/**
 * Compute normalized bigram Dice coefficient between two strings (0–1).
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
  bigramsA.forEach((bigram) => {
    if (bigramsB.has(bigram)) intersectionCount++;
  });

  return (2 * intersectionCount) / (bigramsA.size + bigramsB.size);
}

/**
 * Check that enough significant words from the festival name appear in the
 * playlist name. Prevents "Funk Tribu" matching "Funk Tribe Underground".
 */
function hasWordOverlap(playlistName: string, festivalName: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  const festivalWords = normalize(festivalName)
    .split(/\s+/)
    .filter((w) => w.length > MIN_WORD_LENGTH);

  if (festivalWords.length === 0) return false;

  const playlistNormalized = normalize(playlistName);
  const matchCount = festivalWords.filter((w) =>
    playlistNormalized.includes(w)
  ).length;

  return matchCount >= Math.ceil(festivalWords.length * WORD_OVERLAP_RATIO);
}

/**
 * Return true only when both similarity score and word overlap are confident.
 */
function isConfidentMatch(
  playlistName: string,
  festivalName: string
): boolean {
  return (
    computeSimilarity(playlistName, festivalName) >= SIMILARITY_THRESHOLD &&
    hasWordOverlap(playlistName, festivalName)
  );
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
 * Extract the most likely headliner from patterns like "Funk Tribu pres. TRIBE".
 */
function extractHeadliner(festivalName: string): string | null {
  const presMatch = festivalName.match(/^(.+?)\s+(?:pres\.?|presents)/i);
  if (presMatch) return presMatch[1].trim();
  return null;
}

/**
 * Find a Spotify playlist for a festival using a smart multi-step strategy:
 *
 * 1. Search for the sanitized festival name — accept only confident matches
 *    (similarity ≥ 0.75 AND word overlap ≥ 70%).
 * 2. If no confident match, try "This is {headliner}" (passed or extracted).
 * 3. Return null if nothing confident is found — better no playlist than a wrong one.
 */
export async function getFestivalPlaylist(
  festivalName: string,
  headlinerName?: string
): Promise<FestivalPlaylistData | null> {
  if (!festivalName) return null;

  try {
    const sanitizedName = sanitizeFestivalName(festivalName);

    // Step 1: Search by sanitized festival name, require confident match
    const candidates = await spotifySearchPlaylist(
      sanitizedName,
      SEARCH_CANDIDATE_LIMIT
    );

    const closeMatch = candidates.find((p) =>
      isConfidentMatch(p.name, sanitizedName)
    );
    if (closeMatch) return closeMatch;

    // Step 2: Try "This is {headliner}" — either passed explicitly or extracted
    const resolvedHeadliner = headlinerName ?? extractHeadliner(festivalName);

    if (resolvedHeadliner) {
      const thisIsQuery = `This is ${resolvedHeadliner}`;
      const thisIsResults = await spotifySearchPlaylist(
        thisIsQuery,
        SEARCH_CANDIDATE_LIMIT
      );

      const thisIsMatch = thisIsResults.find(
        (p) =>
          p.name.toLowerCase().startsWith("this is") &&
          computeSimilarity(p.name, thisIsQuery) >= SIMILARITY_THRESHOLD
      );
      if (thisIsMatch) return thisIsMatch;
    }
  } catch (err) {
    console.error("[festival-playlist] Error searching playlist:", err);
  }

  return null;
}
