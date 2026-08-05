"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivalArtists, artists } from "@/db/schema";

/** Fetch lineup artist names for a single festival (on-demand) */
export async function getFestivalLineupNames(festivalId: string): Promise<string[]> {
  const rows = await db
    .select({ artistName: artists.name })
    .from(festivalArtists)
    .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
    .where(eq(festivalArtists.festivalId, festivalId));

  return rows.map((r) => r.artistName);
}
