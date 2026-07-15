"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivalArtists, artists } from "@/db/schema";
import { getOptionalUserId } from "./festival-helpers";
import { fetchUserDataForId } from "./user-data-query";

/** Fetch lineup artist names for a single festival (on-demand) */
export async function getFestivalLineupNames(festivalId: string): Promise<string[]> {
  const rows = await db
    .select({ artistName: artists.name })
    .from(festivalArtists)
    .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
    .where(eq(festivalArtists.festivalId, festivalId));

  return rows.map((r) => r.artistName);
}

/**
 * Fetches all user data server-side for SSR hydration.
 * Returns null if not authenticated.
 */
export async function getInitialUserData() {
  const userId = await getOptionalUserId();
  if (!userId) return null;

  return fetchUserDataForId(userId);
}

export type InitialUserData = Awaited<ReturnType<typeof getInitialUserData>>;
