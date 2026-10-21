/**
 * Queries behind getPopularFestivals (popular-festivals.ts), uncached.
 *
 * Popular festivals for the empty My festivals page: recent past ones to mark
 * as attended and upcoming ones to mark as going. Ranked by the same social
 * score as trending-festivals.ts (interested + visitors), but with full rows,
 * since "tap to add" sends them to toggleFestival as meta.
 */

import { db } from "@/db";
import { festivals } from "@/db/schema";
import { and, gt, gte, lt, sql, type SQL } from "drizzle-orm";
import { addDays } from "@/lib/dates";

const LIST_LIMIT = 5;
/** Fewer city matches than this falls back to everywhere. */
const CITY_MIN_RESULTS = 3;
const PAST_WINDOW_DAYS = 365;

export type PopularFestival = {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  venue: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  source: string | null;
};

export type PopularList = { festivals: PopularFestival[]; isNearCity: boolean };
export type PopularFestivals = { past: PopularList; upcoming: PopularList };

const columns = {
  id: festivals.id,
  name: festivals.name,
  date: festivals.date,
  endDate: festivals.endDate,
  venue: festivals.venue,
  location: festivals.location,
  latitude: festivals.latitude,
  longitude: festivals.longitude,
  imageUrl: festivals.imageUrl,
  source: festivals.source,
};

const score = sql`COALESCE(${festivals.interestedCount}, 0) + COALESCE(${festivals.visitorsCount}, 0)`;
const lastDay = sql`COALESCE(${festivals.endDate}, ${festivals.date})`;

async function queryPopular(window: SQL, order: SQL, city: string | null): Promise<PopularFestival[]> {
  const cityFilter = city ? sql`${festivals.location} ILIKE ${"%" + city.replace(/[%_\\]/g, "\\$&") + "%"}` : undefined;
  const rows = await db
    .select(columns)
    .from(festivals)
    .where(and(window, gt(score, 0), cityFilter))
    .orderBy(order)
    .limit(LIST_LIMIT);
  return rows as PopularFestival[];
}

async function queryWithFallback(window: SQL, order: SQL, city: string | null): Promise<PopularList> {
  if (city) {
    const near = await queryPopular(window, order, city);
    if (near.length >= CITY_MIN_RESULTS) return { festivals: near, isNearCity: true };
  }
  return { festivals: await queryPopular(window, order, null), isNearCity: false };
}

/** Both lists for one day and city; popular-festivals.ts caches this. */
export async function queryPopularFestivals(today: string, city: string | null): Promise<PopularFestivals> {
  const pastWindow = and(lt(lastDay, today), gte(festivals.date, addDays(today, -PAST_WINDOW_DAYS)))!;
  const [past, upcoming] = await Promise.all([
    queryWithFallback(pastWindow, sql`${score} DESC, ${festivals.date} DESC`, city),
    queryWithFallback(gte(lastDay, today), sql`${score} DESC, ${festivals.date} ASC`, city),
  ]);
  return { past, upcoming };
}

