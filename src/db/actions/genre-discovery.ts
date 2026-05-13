"use server";

import {
  lastfmGetTagTopArtists,
  lastfmGetTagTopTracks,
  type TagTopArtist,
  type TagTopTrack,
} from "@/services/lastfm/client";

/**
 * Maps display-friendly genre names to Last.fm tag names.
 * Last.fm tags are case-insensitive but some have specific formats.
 */
const GENRE_TO_LASTFM_TAG: Record<string, string> = {
  techno: "techno",
  house: "house",
  trance: "trance",
  "drum and bass": "drum and bass",
  "drum & bass": "drum and bass",
  ambient: "ambient",
  "melodic techno": "melodic techno",
  "melodic techno & house": "melodic techno",
  "deep house": "deep house",
  "tech house": "tech house",
  minimal: "minimal",
  progressive: "progressive house",
  industrial: "industrial",
  hardstyle: "hardstyle",
  breaks: "breakbeat",
  electro: "electro",
  disco: "disco",
};

// ── Types ──────────────────────────────────────────────────────────────────

export type GenreDiscoveryData = {
  genre: string;
  displayName: string;
  artists: TagTopArtist[];
  tracks: TagTopTrack[];
};

// ── Public Functions ───────────────────────────────────────────────────────

/**
 * Fetch discovery data for a single genre.
 * Returns top artists and tracks from Last.fm for the given genre tag.
 */
export async function getGenreDiscoveryData(
  genre: string
): Promise<GenreDiscoveryData> {
  const normalizedGenre = genre.toLowerCase().trim();
  const lastfmTag = GENRE_TO_LASTFM_TAG[normalizedGenre] ?? normalizedGenre;

  const [artists, tracks] = await Promise.all([
    lastfmGetTagTopArtists(lastfmTag, 6),
    lastfmGetTagTopTracks(lastfmTag, 6),
  ]);

  return {
    genre: normalizedGenre,
    displayName: capitalizeGenre(normalizedGenre),
    artists,
    tracks,
  };
}

/**
 * Fetch discovery data for multiple genres in parallel.
 * Used when loading the Discover page with default or user genres.
 */
export async function getMultipleGenresDiscoveryData(
  genres: string[]
): Promise<GenreDiscoveryData[]> {
  const uniqueGenres = [...new Set(genres.map((g) => g.toLowerCase().trim()))];
  const limitedGenres = uniqueGenres.slice(0, 5); // Limit to 5 genres max

  const results = await Promise.all(
    limitedGenres.map((genre) => getGenreDiscoveryData(genre))
  );

  // Filter out genres with no results
  return results.filter((r) => r.artists.length > 0 || r.tracks.length > 0);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function capitalizeGenre(genre: string): string {
  // Handle special cases
  const specialCases: Record<string, string> = {
    "drum and bass": "Drum & Bass",
    "drum & bass": "Drum & Bass",
    "melodic techno & house": "Melodic Techno & House",
    "deep house": "Deep House",
    "tech house": "Tech House",
  };

  if (specialCases[genre]) return specialCases[genre];

  // Default: capitalize each word
  return genre
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
