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
  SPOTIFY_UPSERT_IMAGE,
  canSpotifyReplacePhoto,
  raPhotoFieldsFromLookup,
  spotifyPhotoFields,
} from "./artist-image-guard";
import { resolveSpotifyArtist } from "./spotify-verify-core";
import {
  MAX_ARTIST_NAME_LENGTH,
  MAX_ENRICHMENT_BATCH_SIZE,
  RATE_LIMIT_CACHE_MAX,
  RATE_LIMIT_SEARCH_MAX,
  RATE_LIMIT_WINDOW_MS,
  SPOTIFY_STALE_MS,
  LASTFM_STALE_MS,
  RELATED_ARTISTS_STALE_MS,
  RA_EVENTS_STALE_MS,
} from "@/lib/constants";

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
  return Date.now() - ms > SPOTIFY_STALE_MS;
}

function isStaleLastfm(fetchedAt: Date | string | null | undefined): boolean {
  if (!fetchedAt) return true;
  const ms = fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();
  return Date.now() - ms > LASTFM_STALE_MS;
}

function isStaleRelatedArtists(fetchedAt: Date | null | undefined): boolean {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt.getTime() > RELATED_ARTISTS_STALE_MS;
}

function isStaleRAEvents(fetchedAt: Date | null | undefined): boolean {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt.getTime() > RA_EVENTS_STALE_MS;
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

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

// Shape guards for the cached JSON columns. Deliberately minimal — they check
// the identifying required fields so a stale/schema-drifted blob can't flow to
// the UI as if valid; optional/nullable fields are left to the consumer.
const isSpotifyAlbum = (x: unknown): x is SpotifyAlbum =>
  isRecord(x) && typeof x.id === "string" && typeof x.name === "string";
const isRelatedArtist = (x: unknown): x is RelatedArtist =>
  isRecord(x) && typeof x.id === "string" && typeof x.name === "string";
const isLastfmSimilar = (x: unknown): x is LastfmSimilar =>
  isRecord(x) && typeof x.name === "string";
const isLastfmTrack = (x: unknown): x is LastfmTrack =>
  isRecord(x) && typeof x.name === "string";
const isRAUpcomingEvent = (x: unknown): x is RAUpcomingEvent =>
  isRecord(x) && typeof x.id === "string" && typeof x.date === "string";

/**
 * Parse a cached JSON array column, dropping any element that fails its shape
 * guard (and returning [] for null / parse errors / a non-array payload). This
 * stops a stale or schema-drifted blob from reaching the UI as if valid — e.g.
 * an old spotifyAlbums shape missing fields the artist page reads.
 */
function parseJsonArray<T>(
  value: string | null | undefined,
  isValid: (item: unknown) => item is T
): T[] {
  if (!value) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValid);
}

function rowToArtistData(row: typeof artists.$inferSelect): ArtistData {
  return {
    id: row.id,
    name: row.name,
    spotifyId: row.spotifyId ?? null,
    imageUrl: row.imageUrl ?? null,
    spotifyFollowers: row.spotifyFollowers ?? null,
    spotifyAlbums: parseJsonArray(row.spotifyAlbums, isSpotifyAlbum),
    relatedArtists: parseJsonArray(row.relatedArtists, isRelatedArtist),
    lastfmId: row.lastfmId ?? null,
    lastfmBio: row.lastfmBio ?? null,
    genres: [], // populated separately from artist_genres table
    lastfmListeners: row.lastfmListeners ?? null,
    lastfmPlaycount: row.lastfmPlaycount ?? null,
    lastfmSimilar: parseJsonArray(row.lastfmSimilar, isLastfmSimilar),
    lastfmTopTracks: parseJsonArray(row.lastfmTopTracks, isLastfmTrack),
    raArtistId: row.raArtistId ?? null,
    raUpcomingEvents: parseJsonArray(row.raUpcomingEvents, isRAUpcomingEvent),
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
    // An RA or admin-set photo is never replaced by Spotify's.
    if (canSpotifyReplacePhoto(row)) Object.assign(updateFields, spotifyPhotoFields(spotifyUpdate.image));
    updateFields.spotifyFollowers = spotifyUpdate.followers ?? null;
    updateFields.spotifyAlbums = JSON.stringify(spotifyUpdate.albums ?? []);
    // Only overwrite top tracks with Spotify data if we actually got tracks back
    if (spotifyUpdate.topTracks?.length) {
      updateFields.lastfmTopTracks = JSON.stringify(spotifyUpdate.topTracks);
    }
    if (spotifyUpdate.id === null) {
      // The stored link pointed at somebody else and nothing replaces it: drop
      // what was derived from it, so the next view re-derives it (Last.fm tracks).
      updateFields.relatedArtists = null;
      updateFields.relatedArtistsFetchedAt = null;
      if (!updateFields.lastfmTopTracks) updateFields.lastfmTopTracks = null;
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
    // RA's curated profile photo, when the profile found is this artist.
    Object.assign(updateFields, raPhotoFieldsFromLookup(row, raDataUpdate, now));
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

  // Compare on lower(name) so this hits the case-insensitive unique index
  // instead of seq-scanning artists (there is no btree on the raw name).
  const imageRows = await db
    .select({ name: artists.name, imageUrl: artists.imageUrl })
    .from(artists)
    .where(inArray(sql`lower(${artists.name})`, similarNames.map(name => name.toLowerCase())))
    .catch(() => []);

  // Keyed by lowercased name: the lookup is case-insensitive, so Last.fm's
  // casing of a similar artist need not match the casing stored in the DB.
  const imageByLowerName = new Map(imageRows.map(r => [r.name.toLowerCase(), r.imageUrl ?? null] as const));
  return {
    ...data,
    lastfmSimilar: data.lastfmSimilar.map(a => ({
      ...a,
      image: imageByLowerName.get(a.name.toLowerCase()) ?? null as string | null,
    })),
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

/** Batched form of fetchArtistGenres — one query for many artist ids. */
async function fetchArtistGenresBatch(artistIds: string[]): Promise<Map<string, string[]>> {
  if (!artistIds.length) return new Map();
  const rows = await db
    .select({ artistId: artistGenres.artistId, name: genres.name })
    .from(artistGenres)
    .innerJoin(genres, eq(artistGenres.genreId, genres.id))
    .where(inArray(artistGenres.artistId, artistIds));

  const byArtistId = new Map<string, string[]>();
  for (const row of rows) {
    const list = byArtistId.get(row.artistId);
    if (list) list.push(row.name);
    else byArtistId.set(row.artistId, [row.name]);
  }
  return byArtistId;
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

      const similarRows = similarNames.map((similarName: string) => ({
        name: similarName,
        spotifyId: spotifyResults[similarName]?.id ?? null,
        ...spotifyPhotoFields(spotifyResults[similarName]?.image),
        spotifyFollowers: spotifyResults[similarName]?.followers ?? null,
        spotifyFetchedAt: now,
      }));
      const updates = similarRows.filter((r) => existingByLower.has(r.name.toLowerCase()));
      const inserts = similarRows.filter((r) => !existingByLower.has(r.name.toLowerCase()));

      // Known-existing rows: one multi-row upsert keyed on id.
      if (updates.length) {
        await db.insert(artists).values(
          updates.map((r) => ({ ...r, id: existingByLower.get(r.name.toLowerCase())! }))
        ).onConflictDoUpdate({
          target: artists.id,
          set: {
            spotifyId: sql`excluded.spotify_id`,
            // An RA or admin-set photo stays; see artist-image-guard.ts.
            ...SPOTIFY_UPSERT_IMAGE,
            spotifyFollowers: sql`excluded.spotify_followers`,
            spotifyFetchedAt: sql`excluded.spotify_fetched_at`,
          },
        }).catch((err) => {
          console.error('[artists] similar-artist batch update failed:', err instanceof Error ? err.message : err);
        });
      }

      // Brand-new names: one multi-row insert, deduped on any unique violation.
      if (inserts.length) {
        await db.insert(artists).values(inserts).onConflictDoNothing().catch((err) => {
          console.error('[artists] similar-artist batch insert failed:', err instanceof Error ? err.message : err);
        });
      }
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

/** Result of refreshSpotify when a wrong stored link is dropped. */
const CLEARED_SPOTIFY = {
  id: null as string | null,
  image: null as string | null,
  followers: 0,
  albums: [] as any[],
  topTracks: [] as any[],
};

async function refreshSpotify(name: string, existingSpotifyId: string | null) {
  try {
    // The stored link is only kept while it still points at an artist with our
    // name (Franck was linked to Frank Ocean); otherwise re-matched by exact name.
    const { artist: spArtist, hadWrongLink } = await resolveSpotifyArtist(name, existingSpotifyId);

    if (!spArtist) {
      console.warn(`[artists] No Spotify artist found for "${name}" — followers will not be updated`);
      // A stored link that pointed at somebody else, with nothing to replace it, is cleared.
      return hadWrongLink ? CLEARED_SPOTIFY : null;
    }

    console.log(`[artists] Spotify found for "${name}": ${spArtist.followers} followers, id=${spArtist.id}`);

    const [albums, topTracks] = await Promise.all([
      spotifyGetArtistAlbums(spArtist.id).catch((err) => {
        console.error(`[spotify] Failed to fetch albums for "${spArtist.name}":`, err instanceof Error ? err.message : err);
        return [] as any[];
      }),
      spotifyGetArtistTopTracks(spArtist.id).catch((err) => {
        console.warn(`[spotify] Failed to fetch top tracks for "${spArtist.name}":`, err instanceof Error ? err.message : err);
        return [] as any[];
      }),
    ]);
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
  await enforceRateLimit("enrich", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);
  const results: Record<string, { name: string; image: string | null; genres: string[] }> = {};

  // Reuse cached artists rows (same staleness windows as getArtistData)
  // instead of re-hitting Spotify/Last.fm for names already enriched
  // elsewhere (e.g. via festival lineup imports).
  const lowerNames = names.map((n) => n.toLowerCase());
  const cachedRows = await db.select({
    id: artists.id,
    name: artists.name,
    imageUrl: artists.imageUrl,
    spotifyFetchedAt: artists.spotifyFetchedAt,
    lastfmFetchedAt: artists.lastfmFetchedAt,
  }).from(artists).where(sql`lower(${artists.name}) IN ${lowerNames}`);

  const cachedByLower = new Map(cachedRows.map((r) => [r.name.toLowerCase(), r]));
  const isFresh = (r: (typeof cachedRows)[number]) =>
    !isStaleSpotify(r.spotifyFetchedAt) && !isStaleLastfm(r.lastfmFetchedAt);
  const freshIds = cachedRows.filter(isFresh).map((r) => r.id);
  const genresByArtistId = await fetchArtistGenresBatch(freshIds);

  const needsFetch: string[] = [];
  for (const name of names) {
    const row = cachedByLower.get(name.toLowerCase());
    if (row && isFresh(row)) {
      results[name.toLowerCase()] = {
        name,
        image: row.imageUrl ?? null,
        genres: genresByArtistId.get(row.id) ?? [],
      };
    } else {
      needsFetch.push(name);
    }
  }

  await Promise.all(
    needsFetch.map(async (name) => {
      let image: string | null = null;
      let genres: string[] = [];

      const [sp, info] = await Promise.all([
        spotifySearchArtist(name).catch(() => null),
        lastfmGetArtistInfo(name).catch(() => null),
      ]);
      // Photos come from Spotify only: Last.fm has none for artists anymore, and a stored photo (RA, manual) wins.
      if (sp) image = sp.image;
      if (info) genres = info.tags || [];
      image = cachedByLower.get(name.toLowerCase())?.imageUrl ?? image;

      results[name.toLowerCase()] = { name, image, genres };
    })
  );

  return results;
}
