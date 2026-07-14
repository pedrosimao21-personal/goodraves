"use server";

import { db } from "@/db";
import { festivals } from "@/db/schema";
import { gte, gt, and, sql } from "drizzle-orm";

const DEFAULT_LIMIT = 6;
const RADIUS_KM = 100;
const EARTH_RADIUS_KM = 6371;

export type TrendingFestival = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  imageUrl: string | null;
  interestedCount: number;
  visitorsCount: number;
  distanceKm: number | null;
};

/** Combined social-proof score used to rank trending festivals across sources. */
function trendingScore(row: { interestedCount: number; visitorsCount: number }): number {
  return row.interestedCount + row.visitorsCount;
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
 * Fetch trending upcoming festivals sorted by interestedCount descending.
 *
 * - Only festivals with interestedCount > 0 are returned.
 * - When userCoords are provided, filters to RADIUS_KM and sorts by interest then date.
 * - When userCity is provided (no coords), falls back to city-name substring match.
 * - Global fallback: top trending worldwide regardless of location.
 */
export async function getTrendingFestivals(
  userCity?: string | null,
  userCoords?: { lat: number; lng: number } | null,
  limit = DEFAULT_LIMIT
): Promise<TrendingFestival[]> {
  const todayStr = new Date().toISOString().split("T")[0];

  const rows = await db
    .select({
      id: festivals.id,
      name: festivals.name,
      date: festivals.date,
      location: festivals.location,
      imageUrl: festivals.imageUrl,
      latitude: festivals.latitude,
      longitude: festivals.longitude,
      interestedCount: festivals.interestedCount,
      visitorsCount: festivals.visitorsCount,
    })
    .from(festivals)
    .where(
      and(
        gte(festivals.date, todayStr),
        gt(
          sql`COALESCE(${festivals.interestedCount}, 0) + COALESCE(${festivals.visitorsCount}, 0)`,
          0
        )
      )
    )
    .orderBy(festivals.date)
    .limit(200);

  // Attach distance calculation
  const withInterest = rows.map((row) => {
      let distanceKm: number | null = null;
      if (userCoords && row.latitude !== null && row.longitude !== null) {
        distanceKm = haversineKm(
          userCoords.lat,
          userCoords.lng,
          row.latitude,
          row.longitude
        );
      }
      return {
        ...row,
        distanceKm,
        interestedCount: row.interestedCount ?? 0,
        visitorsCount: row.visitorsCount ?? 0,
      };
    });

  // Nearby: within radius, sorted by interest then date
  if (userCoords) {
    const nearby = withInterest
      .filter((r) => r.distanceKm !== null && r.distanceKm <= RADIUS_KM)
      .sort((a, b) => {
        if (trendingScore(b) !== trendingScore(a)) {
          return trendingScore(b) - trendingScore(a);
        }
        return a.date.localeCompare(b.date);
      });

    if (nearby.length >= 3) {
      return nearby
        .slice(0, limit)
        .map(({ latitude, longitude, ...rest }) => rest);
    }
  }

  // City-name fallback: substring match, sorted by interest
  if (userCity) {
    const cityLower = userCity.toLowerCase().trim();
    const cityMatches = withInterest
      .filter((r) => r.location?.toLowerCase().includes(cityLower))
      .sort((a, b) => {
        if (trendingScore(b) !== trendingScore(a)) {
          return trendingScore(b) - trendingScore(a);
        }
        return a.date.localeCompare(b.date);
      });

    if (cityMatches.length > 0) {
      return cityMatches
        .slice(0, limit)
        .map(({ latitude, longitude, ...rest }) => rest);
    }
  }

  // Global fallback: top trending worldwide
  return withInterest
    .sort((a, b) => {
      if (trendingScore(b) !== trendingScore(a)) {
        return trendingScore(b) - trendingScore(a);
      }
      return a.date.localeCompare(b.date);
    })
    .slice(0, limit)
    .map(({ latitude, longitude, ...rest }) => rest);
}
