"use server";

import { unstable_cache } from "next/cache";
import { toIsoDate } from "@/lib/dates";
import { queryMostFollowed, type MostFollowedArtist } from "./most-followed-core";

const CACHE_REVALIDATE_SECONDS = 15 * 60;

const getCachedMostFollowed = unstable_cache(queryMostFollowed, ["most-followed-artists"], {
  revalidate: CACHE_REVALIDATE_SECONDS,
});

/** Most followed artists with their upcoming counts (see most-followed-core.ts), cached per day. */
export async function getMostFollowedArtists(): Promise<MostFollowedArtist[]> {
  return getCachedMostFollowed(toIsoDate(new Date()));
}
