"use server";

import { db } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { artists, genres, artistGenres } from "@/db/schema";
import {
  spotifySearchArtist,
  spotifyGetArtist,
  spotifyGetArtistAlbums,
  spotifySearchArtistsBatch,
  spotifyGetArtistTopTracks,
  spotifyGetRelatedArtists,
  spotifySearchTrackPreview,
} from "@/services/spotify/client";
import { lastfmGetArtistInfo, lastfmGetArtistTopTracks } from "@/services/lastfm/client";
import { fetchRArtistEvents, fetchRArtistByName, type RAUpcomingEvent } from "@/services/ra/client";
import { requireAuth, enforceRateLimit } from "./festival-helpers";
import {
  MAX_ARTIST_NAME_LENGTH,
  MAX_ENRICHMENT_BATCH_SIZE,
  RATE_LIMIT_CACHE_MAX,
  RATE_LIMIT_SEARCH_MAX,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/constants";

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;
const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

// Keywords that indicate an artist is in the electronic music space.
// Used to validate Last.fm data before storing it — prevents saving wrong
// bios/tags when Last.fm resolves a DJ name to a different artist entirely.
const ELECTRONIC_KEYWORDS = [
  'dj', 'techno', 'electronic', 'house', 'rave', 'producer', 'trance',
  'berlin', 'club', 'electro', 'dance music', 'edm', 'dubstep',
  'drum and bass', 'dnb', 'ambient', 'minimal', 'hardcore', 'psytrance',
  'deejay', 'nightclub', 'festival', 'vinyl',
]

function isElectronicRelevant(bio: string, tags: string[]): boolean {
  const bioLower = bio.toLowerCase()
  const hasBioKeyword = ELECTRONIC_KEYWORDS.some(k => bioLower.includes(k))
  const hasTagKeyword = tags.some(t =>
    ELECTRONIC_KEYWORDS.some(k => t.toLowerCase().includes(k))
  )
  return hasBioKeyword || hasTagKeyword
}

function isStaleSpotify(fetchedAt: Date | string | null | undefined): boolean {
  if (!fetchedAt) return true;
  const ms = fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();
  return Date.now() - ms > TWO_MONTHS_MS;
}

function isStaleLastfm(fetchedAt: Date | string | null | undefined): boolean {
  if (!fetchedAt) return true;
  const ms = fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();
  return Date.now() - ms > ONE_WEEK_MS;
}

function isStaleRelatedArtists(fetchedAt: Date | null | undefined): boolean {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt.getTime() > THIRTY_DAYS_MS;
}

function isStaleRAEvents(fetchedAt: Date | null | undefined): boolean {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt.getTime() > ONE_DAY_MS;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ArtistData = {
  id: string;
  name: string;
  // Spotify
  spotifyId: string | null;
  imageUrl: string | null;
  spotifyFollowers: number | null;
  spotifyAlbums: SpotifyAlbum[];
  relatedArtists: RelatedArtist[];
  // Last.fm
  lastfmId: string | null;
  lastfmBio: string | null;
  genres: string[];
  lastfmListeners: number | null;
  lastfmPlaycount: number | null;
  lastfmSimilar: LastfmSimilar[];
  lastfmTopTracks: LastfmTrack[];
  // Resident Advisor
  raArtistId: string | null;
  raUpcomingEvents: RAUpcomingEvent[];
  // Country (from RA)
  countryCode: string | null;
  countryName: string | null;
};

type SpotifyAlbum = { id: string; name: string; releaseDate: string; image: string | null; url: string | null; type: string };
type RelatedArtist = { id: string; name: string; image: string | null; followers: number };
type LastfmSimilar = { name: string; url: string | null; image: string | null }; // image resolved from artists table at read time
type LastfmTrack = { name: string; playcount: number; url: string | null; listeners: number; previewUrl?: string | null };

// ── Helpers ────────────────────────────────────────────────────────────────

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function rowToArtistData(row: typeof artists.$inferSelect): ArtistData {
  return {
    id: row.id,
    name: row.name,
    spotifyId: row.spotifyId ?? null,
    imageUrl: row.imageUrl ?? null,
    spotifyFollowers: row.spotifyFollowers ?? null,
    spotifyAlbums: parseJson<SpotifyAlbum[]>(row.spotifyAlbums, []),
    relatedArtists: parseJson<RelatedArtist[]>(row.relatedArtists, []),
    lastfmId: row.lastfmId ?? null,
    lastfmBio: row.lastfmBio ?? null,
    genres: [], // populated separately from artist_genres table
    lastfmListeners: row.lastfmListeners ?? null,
    lastfmPlaycount: row.lastfmPlaycount ?? null,
    lastfmSimilar: parseJson<LastfmSimilar[]>(row.lastfmSimilar, []),
    lastfmTopTracks: parseJson<LastfmTrack[]>(row.lastfmTopTracks, []),
    raArtistId: row.raArtistId ?? null,
    raUpcomingEvents: parseJson<RAUpcomingEvent[]>(row.raUpcomingEvents, []),
    countryCode: row.countryCode ?? null,
    countryName: row.countryName ?? null,
  };
}

// ── Main: fetch artist by DB UUID, refresh stale caches ───────────────────

export async function getArtistData(id: string): Promise<ArtistData | null> {
  const [row] = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
  if (!row) return null;

  const needsLastfm = isStaleLastfm(row.lastfmFetchedAt) || !row.lastfmTopTracks;
  // Also refresh Spotify if albums have never been fetched (row was created by the
  // old getArtistsWithImages flow which didn't save albums), or if the top tracks
  // don't have Spotify's previewUrl format yet.
  const hasSpotifyTracks = typeof row.lastfmTopTracks === 'string' && row.lastfmTopTracks.includes('previewUrl');
  const needsSpotify = isStaleSpotify(row.spotifyFetchedAt) || row.spotifyAlbums === null || !hasSpotifyTracks;
  const needsRelatedArtists = row.spotifyId !== null && isStaleRelatedArtists(row.relatedArtistsFetchedAt);
  // Fetch RA data if we don't have it yet OR if events are stale
  const needsRAData = !row.raArtistId || isStaleRAEvents(row.raEventsFetchedAt);

  if (!needsLastfm && !needsSpotify && !needsRelatedArtists && !needsRAData) {
    const [data, genres] = await Promise.all([
      enrichWithSimilarImages(rowToArtistData(row)),
      fetchArtistGenres(row.id),
    ]);
    data.genres = genres;
    return data;
  }

  const now = new Date();

  // Run all refreshes in parallel where needed
  const [lastfmUpdate, spotifyUpdate, relatedArtistsUpdate, raDataUpdate] = await Promise.all([
    needsLastfm ? refreshLastfm(row.name) : Promise.resolve(null),
    needsSpotify ? refreshSpotify(row.name, row.spotifyId) : Promise.resolve(null),
    needsRelatedArtists ? refreshRelatedArtists(row.spotifyId!) : Promise.resolve(null),
    // Use the new unified RA lookup that returns ID, country, AND events
    needsRAData ? fetchRArtistByName(row.name).catch(() => null) : Promise.resolve(null),
  ]);

  const updateFields: Partial<typeof artists.$inferInsert> = {};

  if (lastfmUpdate) {
    updateFields.lastfmId = lastfmUpdate.mbid ?? null;
    updateFields.lastfmBio = lastfmUpdate.bio ?? null;
    // Genres are stored in the genres/artist_genres tables — see syncArtistGenres below
    updateFields.lastfmListeners = lastfmUpdate.listeners ? parseInt(lastfmUpdate.listeners, 10) || null : null;
    updateFields.lastfmPlaycount = lastfmUpdate.playcount ? parseInt(lastfmUpdate.playcount, 10) || null : null;
    updateFields.lastfmSimilar = JSON.stringify(lastfmUpdate.similar ?? []);
    // Always persist Last.fm top tracks — they are reliable and don't require user auth
    if (lastfmUpdate.topTracks?.length) {
      updateFields.lastfmTopTracks = JSON.stringify(lastfmUpdate.topTracks);
    }
    updateFields.lastfmFetchedAt = now;
  }

  if (spotifyUpdate) {
    updateFields.spotifyId = spotifyUpdate.id ?? null;
    updateFields.imageUrl = spotifyUpdate.image ?? null;
    updateFields.spotifyFollowers = spotifyUpdate.followers ?? null;
    updateFields.spotifyAlbums = JSON.stringify(spotifyUpdate.albums ?? []);
    // Only overwrite top tracks with Spotify data if we actually got tracks back
    if (spotifyUpdate.topTracks?.length) {
      updateFields.lastfmTopTracks = JSON.stringify(spotifyUpdate.topTracks);
    }
    updateFields.spotifyFetchedAt = now;
  }

  if (relatedArtistsUpdate !== null) {
    // Use Spotify related artists when available; if empty (e.g. 403), fall back to
    // Last.fm similar artists mapped to the same shape so the component always has data.
    const resolvedRelated = relatedArtistsUpdate.length > 0
      ? relatedArtistsUpdate
      : (lastfmUpdate?.similar ?? []).map((a: any) => ({
          id: a.name, // use name as id for lastfm-sourced entries
          name: a.name,
          image: null as string | null,
          followers: 0,
        }));
    updateFields.relatedArtists = JSON.stringify(resolvedRelated);
    updateFields.relatedArtistsFetchedAt = now;
  }

  // Update RA data (ID, country, events) from the unified lookup
  if (raDataUpdate !== null) {
    if (raDataUpdate.raArtistId) {
      updateFields.raArtistId = raDataUpdate.raArtistId;
    }
    if (raDataUpdate.countryCode) {
      updateFields.countryCode = raDataUpdate.countryCode;
      updateFields.countryName = raDataUpdate.countryName;
    }
    updateFields.raUpcomingEvents = JSON.stringify(raDataUpdate.events);
    updateFields.raEventsFetchedAt = now;
  }

  if (Object.keys(updateFields).length > 0) {
    await db.update(artists).set(updateFields).where(eq(artists.id, id)).catch((err) => {
      console.error(`[artists] Failed to update cache for "${row.name}":`, err);
    });
  }

  // Sync genres by cross-referencing lastfm tags against known genres
  let matchedGenres: string[] | null = null;
  if (lastfmUpdate?.tags?.length) {
    matchedGenres = await syncArtistGenres(id, lastfmUpdate.tags).catch((err) => {
      console.error(`[artists] Failed to sync genres for "${row.name}":`, err);
      return null;
    });
  }

  // Return merged result immediately without another DB round-trip
  const merged = { ...row, ...updateFields } as typeof artists.$inferSelect;
  const data = await enrichWithSimilarImages(rowToArtistData(merged));
  data.genres = matchedGenres ?? await fetchArtistGenres(id);
  return data;
}

async function enrichWithSimilarImages(data: ArtistData): Promise<ArtistData> {
  const similarNames = data.lastfmSimilar.map(a => a.name).filter(Boolean);
  if (!similarNames.length) return data;

  const imageRows = await db
    .select({ name: artists.name, imageUrl: artists.imageUrl })
    .from(artists)
    .where(inArray(artists.name, similarNames))
    .catch(() => []);

  const imageByName = new Map(imageRows.map(r => [r.name, r.imageUrl ?? null] as const));
  return {
    ...data,
    lastfmSimilar: data.lastfmSimilar.map(a => ({ ...a, image: imageByName.get(a.name) ?? null as string | null })),
  };
}

async function fetchArtistGenres(artistId: string): Promise<string[]> {
  const rows = await db
    .select({ name: genres.name })
    .from(artistGenres)
    .innerJoin(genres, eq(artistGenres.genreId, genres.id))
    .where(eq(artistGenres.artistId, artistId));
  return rows.map(r => r.name);
}

async function syncArtistGenres(artistId: string, tagNames: string[]): Promise<string[]> {
  if (!tagNames.length) return [];

  const matchedGenres = await db
    .select({ id: genres.id, name: genres.name })
    .from(genres)
    .where(inArray(genres.name, tagNames));

  if (!matchedGenres.length) return [];

  await db.delete(artistGenres).where(eq(artistGenres.artistId, artistId));
  await db.insert(artistGenres).values(
    matchedGenres.map(({ id: genreId }) => ({ artistId, genreId }))
  );

  return matchedGenres.map(({ name }) => name);
}

async function refreshLastfm(name: string) {
  try {
    const [info, topTracks] = await Promise.all([
      lastfmGetArtistInfo(name),
      lastfmGetArtistTopTracks(name).catch(() => []),
    ]);

    const tags: string[] = info.tags ?? [];
    const bio: string = info.bio ?? '';

    // Validate that Last.fm returned data for an electronic music artist.
    // If the bio and tags contain no electronic keywords, the result likely
    // resolved to the wrong person (e.g. a classical composer with the same name).
    // In that case, discard bio and tags rather than persist wrong information.
    const bioIsRelevant = !bio || isElectronicRelevant(bio, tags);
    const validatedBio = bioIsRelevant ? bio : null;
    const validatedTags = bioIsRelevant ? tags : [];

    const similarNames = (info.similar ?? []).map((a: any) => a.name).filter(Boolean);

    // Fetch Spotify images for similar artists and upsert them into the artists
    // table so their images are available for DB lookups and navigation is instant.
    if (similarNames.length) {
      const spotifyResults = await spotifySearchArtistsBatch(similarNames).catch(() => ({}) as Record<string, any>);
      const now = new Date();

      // Batch lookup all similar artists at once to avoid N+1 queries
      const lowerSimilarNames = similarNames.map((n: string) => n.toLowerCase());
      const existingSimilar = await db.select({ id: artists.id, name: artists.name })
        .from(artists)
        .where(sql`lower(${artists.name}) IN ${lowerSimilarNames}`);
      const existingByLower = new Map(
        existingSimilar.map((r) => [r.name.toLowerCase(), r.id])
      );

      await Promise.allSettled(
        similarNames.map(async (similarName: string) => {
          const sp = spotifyResults[similarName];
          const spotifyFields = {
            spotifyId: sp?.id ?? null,
            imageUrl: sp?.image ?? null,
            spotifyFollowers: sp?.followers ?? null,
            spotifyFetchedAt: now,
          };

          const existingId = existingByLower.get(similarName.toLowerCase());
          if (existingId) {
            return db.update(artists).set(spotifyFields).where(eq(artists.id, existingId));
          }

          return db.insert(artists).values({ name: similarName, ...spotifyFields }).onConflictDoNothing();
        })
      );
    }

    // Store only name + url — images are resolved from the artists table at read time
    const similar = (info.similar ?? []).map((a: any) => ({
      name: a.name,
      url: a.url ?? null,
    }));

    // Enrich Last.fm top tracks with Spotify 30-second preview URLs in parallel.
    const enrichedTopTracks: LastfmTrack[] = await Promise.all(
      topTracks.map(async (track: any) => {
        const previewUrl = await spotifySearchTrackPreview(name, track.name).catch(() => null);
        return { ...track, previewUrl: previewUrl ?? null };
      })
    );

    return { ...info, bio: validatedBio, tags: validatedTags, similar, topTracks: enrichedTopTracks };
  } catch (err) {
    console.error(`[artists] Last.fm refresh failed for "${name}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function refreshSpotify(name: string, existingSpotifyId: string | null) {
  try {
    const spArtist = existingSpotifyId
      ? await spotifyGetArtist(existingSpotifyId).catch(() => spotifySearchArtist(name))
      : await spotifySearchArtist(name);

    if (!spArtist) {
      console.warn(`[artists] No Spotify artist found for "${name}" — followers will not be updated`);
      return null;
    }

    console.log(`[artists] Spotify found for "${name}": ${spArtist.followers} followers, id=${spArtist.id}`);

    const albums = await spotifyGetArtistAlbums(spArtist.id).catch((err) => {
      console.error(`[spotify] Failed to fetch albums for "${spArtist.name}":`, err instanceof Error ? err.message : err);
      return [] as any[];
    });
    const topTracks = await spotifyGetArtistTopTracks(spArtist.id).catch((err) => {
      console.warn(`[spotify] Failed to fetch top tracks for "${spArtist.name}":`, err instanceof Error ? err.message : err);
      return [] as any[];
    });
    albums.sort((a: any, b: any) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));

    return { ...spArtist, albums, topTracks };
  } catch (err) {
    console.error(`[artists] Spotify refresh failed for "${name}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function refreshRelatedArtists(spotifyId: string) {
  try {
    const related = await spotifyGetRelatedArtists(spotifyId);
    return related;
  } catch (err) {
    console.error(`[artists] Related artists refresh failed for Spotify ID "${spotifyId}":`, err instanceof Error ? err.message : err);
    return null;
  }
}
// ── Snapshot: fast DB-only read, no external API calls ────────────────────
// Used for progressive loading — returns cached data immediately so the page
// can render, while a separate call to getArtistData refreshes stale data.

export async function getArtistDataSnapshot(id: string): Promise<ArtistData | null> {
  const [row] = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
  if (!row) return null;

  const [data, genres] = await Promise.all([
    enrichWithSimilarImages(rowToArtistData(row)),
    fetchArtistGenres(row.id),
  ]);
  data.genres = genres;
  return data;
}

// ── Clear artist cache: wipes all external data so it re-fetches on next load ─
// Used by the "Report wrong data" button on the artist page.

export async function clearArtistCache(artistId: string): Promise<void> {
  // Destructive global cache wipe — restrict to authenticated users and rate-limit.
  await requireAuth();
  await enforceRateLimit("cache-clear", RATE_LIMIT_CACHE_MAX, RATE_LIMIT_WINDOW_MS);
  await db.update(artists).set({
    spotifyId: null,
    imageUrl: null,
    spotifyFollowers: null,
    spotifyAlbums: null,
    spotifyFetchedAt: null,
    relatedArtists: null,
    relatedArtistsFetchedAt: null,
    lastfmId: null,
    lastfmBio: null,
    lastfmListeners: null,
    lastfmPlaycount: null,
    lastfmSimilar: null,
    lastfmTopTracks: null,
    lastfmFetchedAt: null,
    raArtistId: null,
    raUpcomingEvents: null,
    raEventsFetchedAt: null,
    countryCode: null,
    countryName: null,
  }).where(eq(artists.id, artistId));
}

// Used when navigating to a similar artist that may not be in the DB yet.

export async function getOrCreateArtistByName(name: string): Promise<{ id: string; name: string }> {
  // Reachable from public (logged-out) artist pages, so this is intentionally
  // not auth-gated. Validate input to prevent junk/oversized rows; abuse of the
  // create path is further mitigated by rate limiting (see SECURITY_PLAN #6).
  const trimmed = name?.trim() ?? "";
  if (!trimmed || trimmed.length > MAX_ARTIST_NAME_LENGTH) {
    throw new Error("Invalid artist name");
  }
  name = trimmed;

  const [existing] = await db.select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(sql`lower(${artists.name}) = lower(${name})`)
    .limit(1);

  if (existing) return existing;

  // Only new-artist creation is rate-limited; existing-artist lookups above are
  // unthrottled so public navigation/enrichment is not degraded.
  await enforceRateLimit("artist-create", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);

  const [created] = await db
    .insert(artists)
    .values({ name })
    .onConflictDoNothing()
    .returning({ id: artists.id, name: artists.name });

  if (created) return created;

  // Race condition: another request inserted between our select and insert
  const [raced] = await db.select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(sql`lower(${artists.name}) = lower(${name})`)
    .limit(1);

  return raced;
}

// ── Legacy: bulk Spotify image fetch for lineup cards ─────────────────────
// Extracted to artist-images.ts for SRP compliance.
// Import directly: import { getArtistsWithImages } from "@/db/actions/artist-images"

// ── Batch enrichment server action for Top DJs page ───────────────────────
// Called from useSpotifyEnrichment hook on the client side.
// Returns Spotify image + Last.fm genres for each artist name.

export async function enrichArtistNamesBatch(
  names: string[]
): Promise<Record<string, { name: string; image: string | null; genres: string[] }>> {
  // Reachable from the public Top DJs page, so not auth-gated. Cap the batch
  // size to bound outbound Spotify/Last.fm traffic (see SECURITY_PLAN #15);
  // rate limiting (#6) further constrains abuse.
  if (names.length > MAX_ENRICHMENT_BATCH_SIZE) {
    throw new Error(`Batch size must not exceed ${MAX_ENRICHMENT_BATCH_SIZE}`);
  }
  // Always hits Spotify + Last.fm — rate-limit per caller.
  await enforceRateLimit("enrich", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);
  const results: Record<string, { name: string; image: string | null; genres: string[] }> = {};

  await Promise.all(
    names.map(async (name) => {
      let image: string | null = null;
      let genres: string[] = [];

      try {
        const sp = await spotifySearchArtist(name);
        if (sp) image = sp.image;
      } catch {
        // Spotify lookup failed
      }

      try {
        const info = await lastfmGetArtistInfo(name);
        if (info) {
          genres = info.tags || [];
          if (!image) image = info.image;
        }
      } catch {
        // Last.fm lookup failed
      }

      results[name.toLowerCase()] = { name, image, genres };
    })
  );

  return results;
}
