"use server";

import { db } from "@/db";
import { inArray, sql } from "drizzle-orm";
import { artists } from "@/db/schema";
import {
  spotifySearchArtist,
  spotifyGetArtistsBatch,
} from "@/services/spotify/client";
import { SPOTIFY_STALE_MS } from "@/lib/constants";

function isStaleSpotify(fetchedAt: Date | string | null | undefined): boolean {
  if (!fetchedAt) return true;
  const ms = fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();
  return Date.now() - ms > SPOTIFY_STALE_MS;
}

type SpotifyResult = Awaited<ReturnType<typeof spotifySearchArtist>>;
type FetchOutcome = { ok: true; data: SpotifyResult } | { ok: false };

const SEARCH_THROTTLE_MS = 500;

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
): Promise<Record<string, { id: string; imageUrl: string | null; spotifyId: string | null } | null>> {
  if (!names.length) return {};

  const rows = await db.select({
    id: artists.id,
    name: artists.name,
    imageUrl: artists.imageUrl,
    spotifyId: artists.spotifyId,
    spotifyFetchedAt: artists.spotifyFetchedAt,
    // Compare on lower(name): a plain `name` comparison seq-scans the table,
    // since the only btree on names is the case-insensitive lower(name) unique
    // index. Matching that expression makes this an index lookup — and stops
    // "Boris"/"boris" from being treated as two different artists.
  }).from(artists).where(inArray(sql`lower(${artists.name})`, names.map((name) => name.toLowerCase())));

  // Keyed by lowercased name, because the lookup above is case-insensitive: the
  // stored casing can differ from the caller's, so only the lowered form is a
  // reliable key.
  const byLowerName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));

  const needsFetch = names.filter((name) => {
    const row = byLowerName.get(name.toLowerCase());
    return !row || isStaleSpotify(row.spotifyFetchedAt);
  });

  if (needsFetch.length) {
    await fetchAndUpsertArtists(needsFetch, byLowerName);
  }

  return Object.fromEntries(
    names.map((name) => {
      const row = byLowerName.get(name.toLowerCase());
      if (!row) return [name, null];
      return [
        name,
        {
          id: row.id,
          imageUrl: row.imageUrl ?? null,
          spotifyId: row.spotifyId ?? null,
        },
      ];
    })
  );
}

type ArtistImageRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  spotifyId: string | null;
  spotifyFetchedAt: Date | null;
};

async function fetchAndUpsertArtists(
  needsFetch: string[],
  byLowerName: Map<string, ArtistImageRow>
): Promise<void> {
  const withId = needsFetch
    .map((name) => ({ name, spotifyId: byLowerName.get(name.toLowerCase())?.spotifyId ?? null }))
    .filter((e): e is { name: string; spotifyId: string } => !!e.spotifyId);

  const withoutId = needsFetch.filter((name) => !byLowerName.get(name.toLowerCase())?.spotifyId);

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
    if (searchResults.length > 0) await new Promise((r) => setTimeout(r, SEARCH_THROTTLE_MS));
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

  if (toUpsert.length) {
    // Batch lookup all names at once to avoid N+1 individual SELECTs
    const lowerNames = toUpsert.map(({ name }) => name.toLowerCase());
    const existingRows = await db.select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(sql`lower(${artists.name}) IN ${lowerNames}`);

    const existingByLower = new Map(
      existingRows.map((r) => [r.name.toLowerCase(), r.id])
    );

    const updates = toUpsert.filter(({ name }) => existingByLower.has(name.toLowerCase()));
    const inserts = toUpsert.filter(({ name }) => !existingByLower.has(name.toLowerCase()));

    // Known-existing rows: one multi-row upsert keyed on id (the conflict is
    // guaranteed since these ids were just read from the DB).
    if (updates.length) {
      try {
        await db.insert(artists).values(
          updates.map(({ name, data }) => ({
            id: existingByLower.get(name.toLowerCase())!,
            name,
            spotifyId: data?.id ?? null,
            imageUrl: data?.image ?? null,
            spotifyFetchedAt: now,
          }))
        ).onConflictDoUpdate({
          target: artists.id,
          set: {
            spotifyId: sql`excluded.spotify_id`,
            imageUrl: sql`excluded.image_url`,
            spotifyFetchedAt: sql`excluded.spotify_fetched_at`,
          },
        });
      } catch (err) {
        console.error("[artists] batch update failed:", err instanceof Error ? err.message : err);
      }
    }

    // Brand-new names: one multi-row insert. No explicit conflict target so
    // any unique violation (e.g. a concurrent request created the same
    // case-insensitive name first) is silently deduped, same as before.
    if (inserts.length) {
      try {
        await db.insert(artists).values(
          inserts.map(({ name, data }) => ({
            name,
            spotifyId: data?.id ?? null,
            imageUrl: data?.image ?? null,
            spotifyFetchedAt: now,
          }))
        ).onConflictDoNothing();
      } catch (err) {
        console.error("[artists] batch insert failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  for (const { name, data } of toUpsert) {
    byLowerName.set(name.toLowerCase(), {
      ...(byLowerName.get(name.toLowerCase()) as any),
      name,
      spotifyId: data?.id ?? null,
      imageUrl: data?.image ?? null,
      spotifyFetchedAt: now,
    } as any);
  }

  const searchErrorCount = searchResults.filter((r) => !r.fetch.ok).length;
  if (searchErrorCount > 0) {
    console.warn(`[artists] ${searchErrorCount} name search(es) errored; will retry next request`);
  }
}
