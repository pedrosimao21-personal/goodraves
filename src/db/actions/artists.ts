"use server";

import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { artists } from "@/db/schema";
import {
  spotifySearchArtist,
  spotifyGetArtist,
  spotifyGetArtistAlbums,
  spotifyGetArtistsBatch,
  spotifySearchArtistsBatch,
} from "@/db/actions/spotify";
import { lastfmGetArtistInfo, lastfmGetArtistTopTracks } from "@/db/actions/lastfm";

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;
const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;

function isStaleSpotify(fetchedAt: Date | null | undefined): boolean {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt.getTime() > TWO_MONTHS_MS;
}

function isStaleLastfm(fetchedAt: Date | null | undefined): boolean {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt.getTime() > ONE_WEEK_MS;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ArtistData = {
  id: string;
  name: string;
  // Spotify
  spotifyId: string | null;
  imageUrl: string | null;
  genres: string[];
  spotifyUrl: string | null;
  spotifyFollowers: number | null;
  spotifyAlbums: SpotifyAlbum[];
  // Last.fm
  lastfmId: string | null;
  lastfmUrl: string | null;
  lastfmBio: string | null;
  lastfmTags: string[];
  lastfmListeners: number | null;
  lastfmPlaycount: number | null;
  lastfmSimilar: LastfmSimilar[];
  lastfmTopTracks: LastfmTrack[];
};

type SpotifyAlbum = { id: string; name: string; releaseDate: string; image: string | null; url: string | null; type: string };
type LastfmSimilar = { name: string; url: string | null; image: string | null }; // image resolved from artists table at read time
type LastfmTrack = { name: string; playcount: number; url: string | null; listeners: number };

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
    genres: parseJson<string[]>(row.genres, []),
    spotifyUrl: row.spotifyUrl ?? null,
    spotifyFollowers: row.spotifyFollowers ?? null,
    spotifyAlbums: parseJson<SpotifyAlbum[]>(row.spotifyAlbums, []),
    lastfmId: row.lastfmId ?? null,
    lastfmUrl: row.lastfmUrl ?? null,
    lastfmBio: row.lastfmBio ?? null,
    lastfmTags: parseJson<string[]>(row.lastfmTags, []),
    lastfmListeners: row.lastfmListeners ?? null,
    lastfmPlaycount: row.lastfmPlaycount ?? null,
    lastfmSimilar: parseJson<LastfmSimilar[]>(row.lastfmSimilar, []),
    lastfmTopTracks: parseJson<LastfmTrack[]>(row.lastfmTopTracks, []),
  };
}

// ── Main: fetch artist by DB UUID, refresh stale caches ───────────────────

export async function getArtistData(id: string): Promise<ArtistData | null> {
  const [row] = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
  if (!row) return null;

  const needsLastfm = isStaleLastfm(row.lastfmFetchedAt);
  // Also refresh Spotify if albums have never been fetched (row was created by the
  // old getArtistsWithImages flow which didn't save albums).
  const needsSpotify = isStaleSpotify(row.spotifyFetchedAt) || row.spotifyAlbums === null;

  if (!needsLastfm && !needsSpotify) return enrichWithSimilarImages(rowToArtistData(row));

  const now = new Date();

  // Run both refreshes in parallel where needed
  const [lastfmUpdate, spotifyUpdate] = await Promise.all([
    needsLastfm ? refreshLastfm(row.name) : Promise.resolve(null),
    needsSpotify ? refreshSpotify(row.name, row.spotifyId) : Promise.resolve(null),
  ]);

  const updateFields: Partial<typeof artists.$inferInsert> = {};

  if (lastfmUpdate) {
    updateFields.lastfmId = lastfmUpdate.mbid ?? null;
    updateFields.lastfmUrl = lastfmUpdate.url ?? null;
    updateFields.lastfmBio = lastfmUpdate.bio ?? null;
    updateFields.lastfmTags = JSON.stringify(lastfmUpdate.tags ?? []);
    updateFields.lastfmListeners = lastfmUpdate.listeners ? parseInt(lastfmUpdate.listeners, 10) || null : null;
    updateFields.lastfmPlaycount = lastfmUpdate.playcount ? parseInt(lastfmUpdate.playcount, 10) || null : null;
    updateFields.lastfmSimilar = JSON.stringify(lastfmUpdate.similar ?? []);
    updateFields.lastfmTopTracks = JSON.stringify(lastfmUpdate.topTracks ?? []);
    updateFields.lastfmFetchedAt = now;
  }

  if (spotifyUpdate) {
    updateFields.spotifyId = spotifyUpdate.id ?? null;
    updateFields.imageUrl = spotifyUpdate.image ?? null;
    updateFields.genres = JSON.stringify(spotifyUpdate.genres ?? []);
    updateFields.spotifyUrl = spotifyUpdate.url ?? null;
    updateFields.spotifyFollowers = spotifyUpdate.followers ?? null;
    updateFields.spotifyAlbums = JSON.stringify(spotifyUpdate.albums ?? []);
    updateFields.spotifyFetchedAt = now;
  }

  if (Object.keys(updateFields).length > 0) {
    await db.update(artists).set(updateFields).where(eq(artists.id, id)).catch((err) => {
      console.error(`[artists] Failed to update cache for "${row.name}":`, err);
    });
  }

  // Return merged result immediately without another DB round-trip
  const merged = { ...row, ...updateFields } as typeof artists.$inferSelect;
  return enrichWithSimilarImages(rowToArtistData(merged));
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

async function refreshLastfm(name: string) {
  try {
    const [info, topTracks] = await Promise.all([
      lastfmGetArtistInfo(name),
      lastfmGetArtistTopTracks(name, 8),
    ]);

    const similarNames = (info.similar ?? []).map((a: any) => a.name).filter(Boolean);

    // Fetch Spotify images for similar artists and upsert them into the artists
    // table so their images are available for DB lookups and navigation is instant.
    if (similarNames.length) {
      const spotifyResults = await spotifySearchArtistsBatch(similarNames).catch(() => ({}) as Record<string, any>);
      const now = new Date();
      await Promise.allSettled(
        similarNames.map((similarName: string) => {
          const sp = spotifyResults[similarName];
          return db
            .insert(artists)
            .values({
              name: similarName,
              spotifyId: sp?.id ?? null,
              imageUrl: sp?.image ?? null,
              genres: sp?.genres ? JSON.stringify(sp.genres) : null,
              spotifyUrl: sp?.url ?? null,
              spotifyFollowers: sp?.followers ?? null,
              spotifyFetchedAt: now,
            })
            .onConflictDoUpdate({
              target: artists.name,
              set: {
                spotifyId: sp?.id ?? null,
                imageUrl: sp?.image ?? null,
                genres: sp?.genres ? JSON.stringify(sp.genres) : null,
                spotifyUrl: sp?.url ?? null,
                spotifyFollowers: sp?.followers ?? null,
                spotifyFetchedAt: now,
              },
            });
        })
      );
    }

    // Store only name + url — images are resolved from the artists table at read time
    const similar = (info.similar ?? []).map((a: any) => ({
      name: a.name,
      url: a.url ?? null,
    }));

    return { ...info, topTracks, similar };
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

    if (!spArtist) return null;

    const albums = await spotifyGetArtistAlbums(spArtist.id).catch(() => [] as any[]);
    albums.sort((a: any, b: any) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));

    return { ...spArtist, albums };
  } catch (err) {
    console.error(`[artists] Spotify refresh failed for "${name}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Ensure an artist row exists by name, return { id, name } ──────────────
// Used when navigating to a similar artist that may not be in the DB yet.

export async function getOrCreateArtistByName(name: string): Promise<{ id: string; name: string }> {
  const [existing] = await db.select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(eq(artists.name, name))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(artists)
    .values({ name })
    .onConflictDoUpdate({ target: artists.name, set: { name } })
    .returning({ id: artists.id, name: artists.name });

  return created;
}

// ── Legacy: bulk Spotify image fetch for lineup cards ─────────────────────

type SpotifyResult = Awaited<ReturnType<typeof spotifySearchArtist>>;
type FetchOutcome = { ok: true; data: SpotifyResult } | { ok: false };

async function fetchByName(name: string): Promise<FetchOutcome> {
  try {
    return { ok: true, data: await spotifySearchArtist(name) };
  } catch (err) {
    console.error(`[artists] Spotify search failed for "${name}":`, err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

export async function getArtistsWithImages(
  names: string[]
): Promise<Record<string, { id: string; imageUrl: string | null; genres: string[]; spotifyId: string | null } | null>> {
  if (!names.length) return {};

  const rows = await db.select().from(artists).where(inArray(artists.name, names));
  const byName = new Map(rows.map((r) => [r.name, r]));

  const needsFetch = names.filter((name) => {
    const row = byName.get(name);
    return !row || isStaleSpotify(row.spotifyFetchedAt);
  });

  if (needsFetch.length) {
    const withId = needsFetch
      .map((name) => ({ name, spotifyId: byName.get(name)?.spotifyId ?? null }))
      .filter((e): e is { name: string; spotifyId: string } => !!e.spotifyId);

    const withoutId = needsFetch.filter((name) => !byName.get(name)?.spotifyId);

    let batchResults: Record<string, SpotifyResult> = {};
    if (withId.length) {
      try {
        batchResults = await spotifyGetArtistsBatch(withId.map((e) => e.spotifyId));
      } catch (err) {
        console.error("[artists] Spotify batch fetch failed:", err instanceof Error ? err.message : err);
      }
    }

    const searchResults: Array<{ name: string; fetch: FetchOutcome }> = [];
    for (const name of withoutId) {
      if (searchResults.length > 0) await new Promise((r) => setTimeout(r, 500));
      searchResults.push({ name, fetch: await fetchByName(name) });
    }

    const now = new Date();
    const toUpsert: Array<{ name: string; data: SpotifyResult }> = [
      ...withId
        .filter(({ spotifyId }) => spotifyId in batchResults)
        .map(({ name, spotifyId }) => ({ name, data: batchResults[spotifyId] })),
      ...searchResults
        .filter((r): r is { name: string; fetch: { ok: true; data: SpotifyResult } } => r.fetch.ok)
        .map(({ name, fetch }) => ({ name, data: fetch.data })),
    ];

    const upsertResults = await Promise.allSettled(
      toUpsert.map(({ name, data }) =>
        db
          .insert(artists)
          .values({
            name,
            spotifyId: data?.id ?? null,
            imageUrl: data?.image ?? null,
            genres: data?.genres ? JSON.stringify(data.genres) : null,
            spotifyFetchedAt: now,
          })
          .onConflictDoUpdate({
            target: artists.name,
            set: {
              spotifyId: data?.id ?? null,
              imageUrl: data?.image ?? null,
              genres: data?.genres ? JSON.stringify(data.genres) : null,
              spotifyFetchedAt: now,
            },
          })
      )
    );

    upsertResults.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[artists] upsert failed for "${toUpsert[i].name}":`, r.reason);
      }
    });

    for (const { name, data } of toUpsert) {
      byName.set(name, {
        ...(byName.get(name) as any),
        name,
        spotifyId: data?.id ?? null,
        imageUrl: data?.image ?? null,
        genres: data?.genres ? JSON.stringify(data.genres) : null,
        spotifyFetchedAt: now,
      } as any);
    }

    const searchErrorCount = searchResults.filter((r) => !r.fetch.ok).length;
    if (searchErrorCount > 0) {
      console.warn(`[artists] ${searchErrorCount} name search(es) errored; will retry next request`);
    }
  }

  return Object.fromEntries(
    names.map((name) => {
      const row = byName.get(name);
      if (!row) return [name, null];
      return [
        name,
        {
          id: row.id,
          imageUrl: row.imageUrl ?? null,
          genres: row.genres ? (JSON.parse(row.genres) as string[]) : [],
          spotifyId: row.spotifyId ?? null,
        },
      ];
    })
  );
}
