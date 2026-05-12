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
import { fetchRArtistEvents, type RAUpcomingEvent } from "@/services/ra/client";

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;
const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

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
  const needsRAEvents = row.raArtistId !== null && isStaleRAEvents(row.raEventsFetchedAt);

  if (!needsLastfm && !needsSpotify && !needsRelatedArtists && !needsRAEvents) {
    const data = await enrichWithSimilarImages(rowToArtistData(row));
    data.genres = await fetchArtistGenres(row.id);
    return data;
  }

  const now = new Date();

  // Run all refreshes in parallel where needed
  const [lastfmUpdate, spotifyUpdate, relatedArtistsUpdate, raEventsUpdate] = await Promise.all([
    needsLastfm ? refreshLastfm(row.name) : Promise.resolve(null),
    needsSpotify ? refreshSpotify(row.name, row.spotifyId) : Promise.resolve(null),
    needsRelatedArtists ? refreshRelatedArtists(row.spotifyId!) : Promise.resolve(null),
    needsRAEvents ? fetchRArtistEvents(row.raArtistId!).catch(() => null) : Promise.resolve(null),
  ]);

  const updateFields: Partial<typeof artists.$inferInsert> = {};

  if (lastfmUpdate) {
    updateFields.lastfmId = lastfmUpdate.mbid ?? null;
    updateFields.lastfmBio = lastfmUpdate.bio ?? null;
    // Genres are now stored in the genres/artist_genres tables — see upsertArtistGenres below
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

  if (raEventsUpdate !== null) {
    updateFields.raUpcomingEvents = JSON.stringify(raEventsUpdate);
    updateFields.raEventsFetchedAt = now;
  }

  if (Object.keys(updateFields).length > 0) {
    await db.update(artists).set(updateFields).where(eq(artists.id, id)).catch((err) => {
      console.error(`[artists] Failed to update cache for "${row.name}":`, err);
    });
  }

  // Upsert genres from lastfm tags into the new tables
  if (lastfmUpdate?.tags?.length) {
    await upsertArtistGenres(id, lastfmUpdate.tags).catch((err) => {
      console.error(`[artists] Failed to upsert genres for "${row.name}":`, err);
    });
  }

  // Return merged result immediately without another DB round-trip
  const merged = { ...row, ...updateFields } as typeof artists.$inferSelect;
  const data = await enrichWithSimilarImages(rowToArtistData(merged));
  data.genres = lastfmUpdate?.tags ?? await fetchArtistGenres(id);
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

async function upsertArtistGenres(artistId: string, genreNames: string[]): Promise<void> {
  if (!genreNames.length) return;

  // Upsert each genre and collect IDs
  const genreIds: string[] = [];
  for (const name of genreNames) {
    const [row] = await db
      .insert(genres)
      .values({ name })
      .onConflictDoUpdate({ target: genres.name, set: { name } })
      .returning({ id: genres.id });
    genreIds.push(row.id);
  }

  // Replace artist's genre associations
  await db.delete(artistGenres).where(eq(artistGenres.artistId, artistId));
  await db.insert(artistGenres).values(
    genreIds.map(genreId => ({ artistId, genreId }))
  );
}

async function refreshLastfm(name: string) {
  try {
    const [info, topTracks] = await Promise.all([
      lastfmGetArtistInfo(name),
      lastfmGetArtistTopTracks(name).catch(() => []),
    ]);

    const similarNames = (info.similar ?? []).map((a: any) => a.name).filter(Boolean);

    // Fetch Spotify images for similar artists and upsert them into the artists
    // table so their images are available for DB lookups and navigation is instant.
    if (similarNames.length) {
      const spotifyResults = await spotifySearchArtistsBatch(similarNames).catch(() => ({}) as Record<string, any>);
  const now = new Date();
      await Promise.allSettled(
        similarNames.map(async (similarName: string) => {
          const sp = spotifyResults[similarName];
          const spotifyFields = {
            spotifyId: sp?.id ?? null,
            imageUrl: sp?.image ?? null,
            spotifyFollowers: sp?.followers ?? null,
            spotifyFetchedAt: now,
          };

          const [existing] = await db.select({ id: artists.id })
            .from(artists)
            .where(sql`lower(${artists.name}) = lower(${similarName})`)
            .limit(1);

          if (existing) {
            return db.update(artists).set(spotifyFields).where(eq(artists.id, existing.id));
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

    // Enrich Last.fm top tracks with Spotify 30-second preview URLs.
    // We process in batches of 3 to avoid hammering the Spotify search API.
    const PREVIEW_BATCH_SIZE = 3;
    const enrichedTopTracks: LastfmTrack[] = [];
    for (let i = 0; i < topTracks.length; i += PREVIEW_BATCH_SIZE) {
      const batch = topTracks.slice(i, i + PREVIEW_BATCH_SIZE);
      const previews = await Promise.all(
        batch.map((track: any) =>
          spotifySearchTrackPreview(name, track.name).catch(() => null)
        )
      );
      batch.forEach((track: any, idx: number) => {
        enrichedTopTracks.push({ ...track, previewUrl: previews[idx] ?? null });
      });
    }

    return { ...info, similar, topTracks: enrichedTopTracks };
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
// Used when navigating to a similar artist that may not be in the DB yet.

export async function getOrCreateArtistByName(name: string): Promise<{ id: string; name: string }> {
  const [existing] = await db.select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(sql`lower(${artists.name}) = lower(${name})`)
    .limit(1);

  if (existing) return existing;

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
