"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { festivals } from "@/db/schema";
import { gte, lte, gt, and, sql } from "drizzle-orm";
import { fetchFestivalGenresByIds } from "./festival-genres";

const DEFAULT_LIMIT = 6;
const RADIUS_KM = 100;
const EARTH_RADIUS_KM = 6371;
const NEARBY_MIN_RESULTS = 3;
// Candidate window per branch, ranked by score in SQL before the exact
// haversine/limit cut — generous enough that a bounding box or a broad city
// match won't clip a genuinely top-ranked festival before it's considered.
const CANDIDATE_LIMIT = 300;
const TRENDING_CACHE_REVALIDATE_SECONDS = 15 * 60;

export type TrendingFestival = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  imageUrl: string | null;
  interestedCount: number;
  visitorsCount: number;
  distanceKm: number | null;
  genres: string[];
};

type TrendingRow = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  interestedCount: number | null;
  visitorsCount: number | null;
};

/** Attach linked genres to the final trending rows via a single batch lookup. */
async function attachGenres<T extends { id: string }>(
  rows: T[]
): Promise<(T & { genres: string[] })[]> {
  const genresById = await fetchFestivalGenresByIds(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, genres: genresById.get(r.id) ?? [] }));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Degrees-per-km bounding box around a point — a cheap SQL-side prefilter
 * before the exact haversine check in JS. No latitude correction on the
 * longitude delta, so it's slightly generous (a touch wider east-west than a
 * true circle needs) rather than risk excluding a genuinely in-radius row.
 */
function boundingBox(lat: number, lng: number, radiusKm: number) {
  const delta = radiusKm / 111; // ~111km per degree of latitude
  return { minLat: lat - delta, maxLat: lat + delta, minLng: lng - delta, maxLng: lng + delta };
}

const selectColumns = {
  id: festivals.id,
  name: festivals.name,
  date: festivals.date,
  location: festivals.location,
  imageUrl: festivals.imageUrl,
  latitude: festivals.latitude,
  longitude: festivals.longitude,
  interestedCount: festivals.interestedCount,
  visitorsCount: festivals.visitorsCount,
};

/** Rank by social-proof score, then soonest — done in SQL so LIMIT applies
 * to the actually-best rows instead of an arbitrary date-ordered slice. */
const scoreThenDateOrder = sql`(COALESCE(${festivals.interestedCount}, 0) + COALESCE(${festivals.visitorsCount}, 0)) DESC, ${festivals.date} ASC`;

function toTrendingFestival(row: TrendingRow, distanceKm: number | null): Omit<TrendingFestival, "genres"> {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    location: row.location,
    imageUrl: row.imageUrl,
    interestedCount: row.interestedCount ?? 0,
    visitorsCount: row.visitorsCount ?? 0,
    distanceKm,
  };
}

async function queryNearby(
  todayStr: string,
  lat: number,
  lng: number,
  limit: number
): Promise<Omit<TrendingFestival, "genres">[] | null> {
  const box = boundingBox(lat, lng, RADIUS_KM);
  const rows = await db
    .select(selectColumns)
    .from(festivals)
    .where(
      and(
        gte(festivals.date, todayStr),
        gt(sql`COALESCE(${festivals.interestedCount}, 0) + COALESCE(${festivals.visitorsCount}, 0)`, 0),
        gte(festivals.latitude, box.minLat),
        lte(festivals.latitude, box.maxLat),
        gte(festivals.longitude, box.minLng),
        lte(festivals.longitude, box.maxLng)
      )
    )
    .orderBy(scoreThenDateOrder)
    .limit(CANDIDATE_LIMIT);

  const withDistance = (rows as TrendingRow[])
    .map((row) => ({ row, distanceKm: haversineKm(lat, lng, row.latitude!, row.longitude!) }))
    .filter(({ distanceKm }) => distanceKm <= RADIUS_KM)
    .slice(0, limit); // already SQL-ranked by score/date; the exact-radius filter only drops corner rows, doesn't need a re-sort

  if (withDistance.length < NEARBY_MIN_RESULTS) return null;
  return withDistance.map(({ row, distanceKm }) => toTrendingFestival(row, distanceKm));
}

async function queryByCity(
  todayStr: string,
  city: string,
  limit: number
): Promise<Omit<TrendingFestival, "genres">[] | null> {
  const escaped = city.replace(/[%_\\]/g, "\\$&");
  const rows = await db
    .select(selectColumns)
    .from(festivals)
    .where(
      and(
        gte(festivals.date, todayStr),
        gt(sql`COALESCE(${festivals.interestedCount}, 0) + COALESCE(${festivals.visitorsCount}, 0)`, 0),
        sql`${festivals.location} ILIKE ${"%" + escaped + "%"}`
      )
    )
    .orderBy(scoreThenDateOrder)
    .limit(limit);

  if (rows.length === 0) return null;
  return (rows as TrendingRow[]).map((row) => toTrendingFestival(row, null));
}

async function queryGlobal(todayStr: string, limit: number): Promise<Omit<TrendingFestival, "genres">[]> {
  const rows = await db
    .select(selectColumns)
    .from(festivals)
    .where(
      and(
        gte(festivals.date, todayStr),
        gt(sql`COALESCE(${festivals.interestedCount}, 0) + COALESCE(${festivals.visitorsCount}, 0)`, 0)
      )
    )
    .orderBy(scoreThenDateOrder)
    .limit(limit);

  return (rows as TrendingRow[]).map((row) => toTrendingFestival(row, null));
}

/**
 * Fetch trending upcoming festivals sorted by social-proof score descending.
 *
 * - Only festivals with interestedCount + visitorsCount > 0 are returned.
 * - When userCoords are given, filters to RADIUS_KM (via a SQL bounding box,
 *   then an exact haversine check) and needs at least NEARBY_MIN_RESULTS.
 * - When userCity is given (no coords, or too few nearby), falls back to a
 *   city-name substring match.
 * - Global fallback: top trending worldwide regardless of location.
 *
 * Public, non-user-specific data (identical result for every viewer with the
 * same inputs), so each branch is cached for 15 minutes.
 */
export async function getTrendingFestivals(
  userCity?: string | null,
  userCoords?: { lat: number; lng: number } | null,
  limit = DEFAULT_LIMIT
): Promise<TrendingFestival[]> {
  const todayStr = new Date().toISOString().split("T")[0];
  const city = userCity?.toLowerCase().trim() || null;

  if (userCoords) {
    const nearby = await getCachedNearby(todayStr, userCoords.lat, userCoords.lng, limit);
    if (nearby) return attachGenres(nearby);
  }

  if (city) {
    const cityMatches = await getCachedByCity(todayStr, city, limit);
    if (cityMatches) return attachGenres(cityMatches);
  }

  return attachGenres(await getCachedGlobal(todayStr, limit));
}

const getCachedNearby = unstable_cache(queryNearby, ["trending-festivals-nearby"], {
  revalidate: TRENDING_CACHE_REVALIDATE_SECONDS,
});
const getCachedByCity = unstable_cache(queryByCity, ["trending-festivals-city"], {
  revalidate: TRENDING_CACHE_REVALIDATE_SECONDS,
});
const getCachedGlobal = unstable_cache(queryGlobal, ["trending-festivals-global"], {
  revalidate: TRENDING_CACHE_REVALIDATE_SECONDS,
});
