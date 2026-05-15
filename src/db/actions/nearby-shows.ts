"use server";

import { db } from "@/db";
import { festivals } from "@/db/schema";
import { gte, sql } from "drizzle-orm";

const NEARBY_SHOWS_LIMIT = 5;

export type NearbyShow = {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  imageUrl: string | null;
};

/**
 * Fetch upcoming shows near a city, ordered by date ascending (soonest first).
 * Matches on city name as a substring of the location or venue fields.
 */
export async function getNearbyShows(
  city: string | null,
  limit = NEARBY_SHOWS_LIMIT
): Promise<NearbyShow[]> {
  if (!city || city.trim().length === 0) return [];

  const todayStr = new Date().toISOString().split("T")[0];
  const escaped = city.trim().replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;

  try {
    const rows = await db
      .select({
        id: festivals.id,
        name: festivals.name,
        date: festivals.date,
        endDate: festivals.endDate,
        location: festivals.location,
        venue: festivals.venue,
        imageUrl: festivals.imageUrl,
      })
      .from(festivals)
      .where(
        sql`${festivals.date} >= ${todayStr}
            AND (${festivals.location} ILIKE ${pattern} OR ${festivals.venue} ILIKE ${pattern})`
      )
      .orderBy(festivals.date)
      .limit(limit);

    return rows;
  } catch {
    return [];
  }
}
