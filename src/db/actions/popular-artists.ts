"use server";

import { db } from "@/db";
import { artists } from "@/db/schema";
import { desc, gt } from "drizzle-orm";

const DEFAULT_POPULAR_LIMIT = 12;

export type PopularArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  spotifyFollowers: number;
};

/**
 * Fetch the most popular artists ordered by Spotify followers descending.
 * Used for DJ suggestion chips on the Top DJs page.
 */
export async function getPopularArtists(
  limit = DEFAULT_POPULAR_LIMIT
): Promise<PopularArtist[]> {
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
}
