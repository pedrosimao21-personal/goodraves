"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { artists } from "@/db/schema";
import { desc, gt } from "drizzle-orm";

const DEFAULT_POPULAR_LIMIT = 12;
const MAX_POPULAR_LIMIT = 50;
const POPULAR_CACHE_REVALIDATE_SECONDS = 60 * 60;

export type PopularArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  spotifyFollowers: number;
};

const getCachedPopularArtists = unstable_cache(
  async (limit: number): Promise<PopularArtist[]> => {
    const rows = await db
      .select({
        id: artists.id,
        name: artists.name,
        imageUrl: artists.imageUrl,
        spotifyFollowers: artists.spotifyFollowers,
      })
      .from(artists)
      .where(gt(artists.spotifyFollowers, 0))
      .orderBy(desc(artists.spotifyFollowers))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.imageUrl ?? null,
      spotifyFollowers: r.spotifyFollowers ?? 0,
    }));
  },
  ["popular-artists"],
  { revalidate: POPULAR_CACHE_REVALIDATE_SECONDS }
);

/**
 * Fetch the most popular artists ordered by Spotify followers descending.
 * Used for DJ suggestion chips on the Top DJs page. Public, non-user-specific
 * data — cached for an hour — and `limit` is clamped since it's a
 * client-supplied, unauthenticated argument.
 */
export async function getPopularArtists(
  limit = DEFAULT_POPULAR_LIMIT
): Promise<PopularArtist[]> {
  const cappedLimit = Math.min(Math.max(1, limit), MAX_POPULAR_LIMIT);
  return getCachedPopularArtists(cappedLimit);
}
