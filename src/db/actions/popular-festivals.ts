"use server";

import { unstable_cache } from "next/cache";
import { toIsoDate } from "@/lib/dates";
import { queryPopularFestivals, type PopularFestivals } from "./popular-festivals-core";

const CACHE_REVALIDATE_SECONDS = 15 * 60;

const getCachedPopular = unstable_cache(queryPopularFestivals, ["popular-festivals"], {
  revalidate: CACHE_REVALIDATE_SECONDS,
});

/**
 * Popular festivals from the last 12 months and still to come, near the
 * user's city when it has enough of them, else everywhere (see
 * popular-festivals-core.ts). Public, non-user-specific data, so cached per
 * day and city.
 */
export async function getPopularFestivals(userCity?: string | null): Promise<PopularFestivals> {
  const city = userCity?.toLowerCase().trim() || null;
  return getCachedPopular(toIsoDate(new Date()), city);
}
