"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { artists } from "@/db/schema";
import { enforceRateLimit, requireAuth } from "./festival-helpers";
import { MAX_ARTIST_NAME_LENGTH, RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { toIsoDate } from "@/lib/dates";

const MIN_ARTIST_SEARCH_LENGTH = 2;
const MAX_ARTIST_SEARCH_RESULTS = 8;

export type ArtistSearchResult = {
  artistId: string;
  name: string;
  imageUrl: string | null;
  upcomingCount: number;
};

/**
 * Artist type-ahead for /following: any artist in our DB, so you can follow
 * someone you haven't seen yet. Exact and prefix matches rank first, then
 * artists with upcoming festivals (following them pays off now), then Spotify
 * popularity as a tiebreak between same-named entries.
 */
export async function searchArtists(query: string): Promise<ArtistSearchResult[]> {
  await requireAuth();
  await enforceRateLimit("search-artists", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);

  const trimmed = query.trim().slice(0, MAX_ARTIST_NAME_LENGTH);
  if (trimmed.length < MIN_ARTIST_SEARCH_LENGTH) return [];

  // Escape ILIKE wildcards so a bare "%" can't match every artist.
  const escaped = trimmed.replace(/[%_\\]/g, "\\$&");
  const lowered = trimmed.toLowerCase();
  const today = toIsoDate(new Date());

  // Aliased by hand: in a single-table select Drizzle renders columns without
  // their table name, which makes "id" ambiguous inside this subquery.
  const upcomingCount = sql<number>`(
    SELECT count(*)::int FROM festival_artists fa
    JOIN festivals f ON f.id = fa.festival_id
    WHERE fa.artist_id = "artists"."id"
      AND coalesce(f.end_date, f.date) >= ${today}
  )`;
  const matchRank = sql`CASE
    WHEN lower(${artists.name}) = ${lowered} THEN 0
    WHEN ${artists.name} ILIKE ${`${escaped}%`} THEN 1
    ELSE 2
  END`;

  return db
    .select({ artistId: artists.id, name: artists.name, imageUrl: artists.imageUrl, upcomingCount })
    .from(artists)
    .where(sql`${artists.name} ILIKE ${`%${escaped}%`}`)
    .orderBy(matchRank, sql`${upcomingCount} DESC`, sql`${artists.spotifyFollowers} DESC NULLS LAST`, artists.name)
    .limit(MAX_ARTIST_SEARCH_RESULTS);
}
