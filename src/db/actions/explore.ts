"use server";

import { db } from "@/db";
import { artists } from "@/db/schema";
import { inArray } from "drizzle-orm";
import {
  lastfmGetTagInfo,
  lastfmGetTagTopArtists,
  lastfmGetTagTopTracks,
  lastfmGetTagTopAlbums,
  lastfmGetTopTags,
  lastfmGetSimilarTags,
  type TagInfo,
  type TagTopArtist,
  type TagTopTrack,
  type TagTopAlbum,
  type TopTag,
} from "@/services/lastfm/client";

// ── Constants ──────────────────────────────────────────────────────────────

const TOP_ARTISTS_LIMIT = 12;
const TOP_TRACKS_LIMIT = 10;
const TOP_ALBUMS_LIMIT = 12;

/**
 * Electronic/dance music genres available in the Explore page.
 * Covers the main genres used in the festival/rave scene.
 */
export const EXPLORE_GENRE_OPTIONS: { value: string; label: string }[] = [
  { value: "techno", label: "Techno" },
  { value: "house", label: "House" },
  { value: "trance", label: "Trance" },
  { value: "drum and bass", label: "Drum & Bass" },
  { value: "ambient", label: "Ambient" },
  { value: "melodic techno", label: "Melodic Techno" },
  { value: "deep house", label: "Deep House" },
  { value: "tech house", label: "Tech House" },
  { value: "minimal", label: "Minimal" },
  { value: "hardstyle", label: "Hardstyle" },
  { value: "psytrance", label: "Psytrance" },
  { value: "dubstep", label: "Dubstep" },
  { value: "electro", label: "Electro" },
  { value: "disco", label: "Disco" },
  { value: "progressive house", label: "Progressive House" },
  { value: "industrial", label: "Industrial" },
  { value: "breakbeat", label: "Breakbeat" },
];

// ── Types ──────────────────────────────────────────────────────────────────

export type ArtistWithLink = TagTopArtist & {
  /** Goodraves DB id — present when the artist exists in our database */
  goodravesId: string | null;
};

export type ExploreData = {
  genre: string;
  displayName: string;
  info: TagInfo | null;
  artists: ArtistWithLink[];
  tracks: TagTopTrack[];
  albums: TagTopAlbum[];
  similarTags: string[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function buildDisplayName(genre: string): string {
  const option = EXPLORE_GENRE_OPTIONS.find((o) => o.value === genre);
  if (option) return option.label;

  const specialCases: Record<string, string> = {
    "drum and bass": "Drum & Bass",
    "drum & bass": "Drum & Bass",
    "deep house": "Deep House",
    "tech house": "Tech House",
    "melodic techno": "Melodic Techno",
    "progressive house": "Progressive House",
  };

  if (specialCases[genre]) return specialCases[genre];

  return genre
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Look up Goodraves DB ids for a list of artist names.
 * Returns a map of lowercase name -> db UUID.
 */
async function lookupArtistIds(
  names: string[]
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();

  try {
    const rows = await db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(inArray(artists.name, names));

    const idByName = new Map<string, string>();
    for (const row of rows) {
      idByName.set(row.name.toLowerCase(), row.id);
    }
    return idByName;
  } catch {
    return new Map();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch all data needed to render the Explore page for a given genre.
 * Runs all Last.fm requests in parallel, then enriches artists with
 * Goodraves DB ids in a single batched query.
 */
export async function getExploreData(genre: string): Promise<ExploreData> {
  const normalizedGenre = genre.toLowerCase().trim();
  const displayName = buildDisplayName(normalizedGenre);

  const [info, rawArtists, tracks, albums, similarTags] = await Promise.all([
    lastfmGetTagInfo(normalizedGenre),
    lastfmGetTagTopArtists(normalizedGenre, TOP_ARTISTS_LIMIT),
    lastfmGetTagTopTracks(normalizedGenre, TOP_TRACKS_LIMIT),
    lastfmGetTagTopAlbums(normalizedGenre, TOP_ALBUMS_LIMIT),
    lastfmGetSimilarTags(normalizedGenre),
  ]);

  const artistNames = rawArtists.map((a) => a.name);
  const idByName = await lookupArtistIds(artistNames);

  const enrichedArtists: ArtistWithLink[] = rawArtists.map((artist) => ({
    ...artist,
    goodravesId: idByName.get(artist.name.toLowerCase()) ?? null,
  }));

  return {
    genre: normalizedGenre,
    displayName,
    info,
    artists: enrichedArtists,
    tracks,
    albums,
    similarTags,
  };
}

/**
 * Fetch the global top tags from Last.fm — used to populate the
 * popular genre chips on the explore page initial load.
 */
export async function getExploreSuggestedTags(): Promise<TopTag[]> {
  const allTags = await lastfmGetTopTags();

  // Filter to only tags that overlap with our curated genre list for relevance
  const knownGenreValues = new Set(EXPLORE_GENRE_OPTIONS.map((o) => o.value));
  const filtered = allTags.filter((t) =>
    knownGenreValues.has(t.name.toLowerCase())
  );

  // Fall back to first 12 global tags if filtering produced nothing
  return filtered.length > 0 ? filtered : allTags.slice(0, 12);
}
