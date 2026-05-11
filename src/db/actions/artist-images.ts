"use server";

import { db } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { artists } from "@/db/schema";
import {
  spotifySearchArtist,
  spotifyGetArtistsBatch,
} from "@/services/spotify/client";

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;

function isStaleSpotify(fetchedAt: Date | string | null | undefined): boolean {
  if (!fetchedAt) return true;
  const ms = fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();
  return Date.now() - ms > TWO_MONTHS_MS;
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

  const rows = await db.select().from(artists).where(inArray(artists.name, names));
  const byName = new Map(rows.map((r) => [r.name, r]));

  const needsFetch = names.filter((name) => {
    const row = byName.get(name);
    return !row || isStaleSpotify(row.spotifyFetchedAt);
  });

  if (needsFetch.length) {
    await fetchAndUpsertArtists(needsFetch, byName);
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
          spotifyId: row.spotifyId ?? null,
        },
      ];
    })
  );
}

async function fetchAndUpsertArtists(
  needsFetch: string[],
  byName: Map<string, typeof artists.$inferSelect>
): Promise<void> {
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
    if (searchResults.length > 0) await new Promise((r) => setTimeout(r, SEARCH_THROTTLE_MS));
    searchResults.push({ name, fetch: await fetchByName(name) });
  }

  const now = new Date().toISOString();
  const toUpsert: Array<{ name: string; data: SpotifyResult }> = [
    ...withId
      .filter(({ spotifyId }) => spotifyId in batchResults)
      .map(({ name, spotifyId }) => ({ name, data: batchResults[spotifyId] })),
    ...searchResults
      .filter((r): r is { name: string; fetch: { ok: true; data: SpotifyResult } } => r.fetch.ok)
      .map(({ name, fetch }) => ({ name, data: fetch.data })),
  ];

  const upsertResults = await Promise.allSettled(
    toUpsert.map(async ({ name, data }) => {
      const spotifyFields = {
        spotifyId: data?.id ?? null,
        imageUrl: data?.image ?? null,
        spotifyFetchedAt: now,
      };

      const [existing] = await db.select({ id: artists.id })
        .from(artists)
        .where(sql`lower(${artists.name}) = lower(${name})`)
        .limit(1);

      if (existing) {
        return db.update(artists).set(spotifyFields).where(eq(artists.id, existing.id));
      }

      return db.insert(artists).values({ name, ...spotifyFields }).onConflictDoNothing();
    })
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
      spotifyFetchedAt: now,
    } as any);
  }

  const searchErrorCount = searchResults.filter((r) => !r.fetch.ok).length;
  if (searchErrorCount > 0) {
    console.warn(`[artists] ${searchErrorCount} name search(es) errored; will retry next request`);
  }
}
