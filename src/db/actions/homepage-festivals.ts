"use server";

import { db } from "@/db";
import { festivals } from "@/db/schema";
import { sql, and, gte } from "drizzle-orm";

const DEFAULT_LIMIT = 6;
const RADIUS_KM = 100;
const EARTH_RADIUS_KM = 6371;

export type UpcomingFestival = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  imageUrl: string | null;
  distanceKm: number | null;
};

/**
 * Convert degrees to radians.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Haversine distance between two lat/lng points in kilometres.
 */
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
 * Fetch upcoming festivals (from today onwards) sorted by date.
 *
 * When userCity and userCoords are provided, only festivals within RADIUS_KM
 * of the user are returned. Otherwise falls back to global upcoming festivals.
 */
export async function getUpcomingFestivals(
  userCity?: string | null,
  userCoords?: { lat: number; lng: number } | null,
  limit = DEFAULT_LIMIT
): Promise<UpcomingFestival[]> {
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
    })
    .from(festivals)
    .where(gte(festivals.date, todayStr))
    .orderBy(festivals.date)
    .limit(200); // Fetch a wider set, then filter/sort by distance in JS

  const withDistance = rows.map((row) => {
    let distanceKm: number | null = null;

    if (
      userCoords &&
      row.latitude !== null &&
      row.longitude !== null
    ) {
      distanceKm = haversineKm(
        userCoords.lat,
        userCoords.lng,
        row.latitude,
        row.longitude
      );
    }

    return { ...row, distanceKm };
  });

  // When coordinates are available, filter to radius and sort by distance then date
  if (userCoords) {
    const nearby = withDistance
      .filter((r) => r.distanceKm !== null && r.distanceKm <= RADIUS_KM)
      .sort((a, b) => {
        const distDiff = (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
        if (distDiff !== 0) return distDiff;
        return a.date.localeCompare(b.date);
      });

    // If plenty of nearby results, return them; otherwise fall back to city-name match
    if (nearby.length >= 3) {
      return nearby.slice(0, limit).map(({ latitude, longitude, ...rest }) => rest);
    }
  }

  // City-name fallback: case-insensitive substring match on the location field
  if (userCity) {
    const cityLower = userCity.toLowerCase().trim();
    const cityMatches = withDistance.filter(
      (r) => r.location?.toLowerCase().includes(cityLower)
    );

    if (cityMatches.length > 0) {
      return cityMatches.slice(0, limit).map(({ latitude, longitude, ...rest }) => rest);
    }
  }

  // Global fallback: soonest upcoming festivals regardless of location
  return withDistance
    .slice(0, limit)
    .map(({ latitude, longitude, ...rest }) => rest);
}
