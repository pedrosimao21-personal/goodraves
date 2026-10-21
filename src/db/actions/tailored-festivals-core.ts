/**
 * Query behind getTailoredFestivals (tailored-festivals.ts).
 *
 * Plain server-only module, deliberately NOT `"use server"`: it takes an
 * arbitrary userId (to leave out festivals already on that user's lists), so
 * the action derives it from the session first.
 */

import { db } from "@/db";
import { festivalGenres, festivals, genres as genresTable } from "@/db/schema";
import { and, eq, gte, or, sql } from "drizzle-orm";

const LIST_LIMIT = 5;

export type TailoredFestival = {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  imageUrl: string | null;
};

export type TailoredResult = { festivals: TailoredFestival[]; isNearCity: boolean };

function containsPattern(value: string): string {
  return `%${value.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`;
}

/**
 * Upcoming festivals whose genres match any of `genres` (case-insensitive,
 * "techno" also matches "hard techno"), minus the ones already on the user's
 * lists. Ranked: in the user's city first, then by how many genres match,
 * then the trending score (interested + visitors), then soonest.
 */
export async function queryTailoredFestivals(
  userId: string,
  genres: string[],
  city: string | null,
  today: string,
): Promise<TailoredResult> {
  if (genres.length === 0) return { festivals: [], isNearCity: false };

  const matched = db
    .select({
      festivalId: festivalGenres.festivalId,
      matches: sql<number>`count(distinct ${genresTable.id})::int`.as("matches"),
    })
    .from(festivalGenres)
    .innerJoin(genresTable, eq(genresTable.id, festivalGenres.genreId))
    .where(or(...genres.map((genre) => sql`${genresTable.name} ILIKE ${containsPattern(genre)}`)))
    .groupBy(festivalGenres.festivalId)
    .as("matched");

  const isInCity = city ? sql<boolean>`COALESCE(${festivals.location} ILIKE ${containsPattern(city)}, false)` : sql<boolean>`false`;
  const score = sql`COALESCE(${festivals.interestedCount}, 0) + COALESCE(${festivals.visitorsCount}, 0)`;

  const rows = await db
    .select({
      id: festivals.id,
      name: festivals.name,
      date: festivals.date,
      endDate: festivals.endDate,
      location: festivals.location,
      venue: festivals.venue,
      imageUrl: festivals.imageUrl,
      isInCity,
    })
    .from(festivals)
    .innerJoin(matched, eq(matched.festivalId, festivals.id))
    .where(and(
      gte(sql`COALESCE(${festivals.endDate}, ${festivals.date})`, today),
      sql`${festivals.id} NOT IN (SELECT festival_id FROM user_festivals WHERE user_id = ${userId})`,
    ))
    // Postgres rejects a constant in ORDER BY, so the city rank is left out without a city.
    .orderBy(city
      ? sql`${isInCity} DESC, ${matched.matches} DESC, ${score} DESC, ${festivals.date} ASC`
      : sql`${matched.matches} DESC, ${score} DESC, ${festivals.date} ASC`)
    .limit(LIST_LIMIT);

  return {
    festivals: rows.map(({ isInCity: _isInCity, ...festival }) => festival as TailoredFestival),
    isNearCity: rows.some((row) => row.isInCity),
  };
}
