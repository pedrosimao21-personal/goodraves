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
  lastfmGetArtistStats,
  type TagInfo,
  type TagTopArtist,
  type TagTopTrack,
  type TagTopAlbum,
  type TopTag,
} from "@/services/lastfm/client";
import { EXPLORE_GENRE_OPTIONS } from "@/constants/explore-genres";

// ── Constants ──────────────────────────────────────────────────────────────

const TOP_ARTISTS_LIMIT = 12;
const TOP_TRACKS_LIMIT = 10;
const TOP_ALBUMS_LIMIT = 12;
const LISTENER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Types ──────────────────────────────────────────────────────────────────

export type ArtistWithLink = TagTopArtist & {
  /** Goodraves DB id — present when the artist exists in our database */
  goodravesId: string | null;
  /** Last.fm listener count — used for popularity ranking */
  listeners: number;
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

// ── In-memory listener cache ───────────────────────────────────────────────

type ListenerCacheEntry = {
  listeners: number;
  expiresAt: number;
};

const listenerCache = new Map<string, ListenerCacheEntry>();

function getCachedListeners(artistName: string): number | null {
  const entry = listenerCache.get(artistName.toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    listenerCache.delete(artistName.toLowerCase());
    return null;
  }
  return entry.listeners;
}

function setCachedListeners(artistName: string, listeners: number): void {
  listenerCache.set(artistName.toLowerCase(), {
    listeners,
    expiresAt: Date.now() + LISTENER_CACHE_TTL_MS,
  });
}

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

/**
 * Fetch listener counts for all artists in parallel.
 * Uses in-memory cache to avoid redundant API calls within a 5-minute window.
 * Artists with no cached data are fetched concurrently.
 */
async function enrichArtistsWithListeners(
  rawArtists: TagTopArtist[]
): Promise<Map<string, number>> {
  const listenersByName = new Map<string, number>();

  const uncachedArtists = rawArtists.filter((artist) => {
    const cached = getCachedListeners(artist.name);
    if (cached !== null) {
      listenersByName.set(artist.name.toLowerCase(), cached);
      return false;
    }
    return true;
  });

  if (uncachedArtists.length > 0) {
    const statsResults = await Promise.all(
      uncachedArtists.map((artist) => lastfmGetArtistStats(artist.name))
    );

    for (let i = 0; i < uncachedArtists.length; i++) {
      const artist = uncachedArtists[i];
      const stats = statsResults[i];
      const listeners = stats?.listeners ?? 0;
      listenersByName.set(artist.name.toLowerCase(), listeners);
      setCachedListeners(artist.name, listeners);
    }
  }

  return listenersByName;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch all data needed to render the Explore page for a given genre.
 * Runs all Last.fm requests in parallel, enriches artists with listener
 * counts (sorted by popularity), and resolves Goodraves DB ids.
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

  const [idByName, listenersByName] = await Promise.all([
    lookupArtistIds(rawArtists.map((a) => a.name)),
    enrichArtistsWithListeners(rawArtists),
  ]);

  const enrichedArtists: ArtistWithLink[] = rawArtists
    .map((artist) => ({
      ...artist,
      goodravesId: idByName.get(artist.name.toLowerCase()) ?? null,
      listeners: listenersByName.get(artist.name.toLowerCase()) ?? 0,
    }))
    .sort((a, b) => b.listeners - a.listeners);

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
