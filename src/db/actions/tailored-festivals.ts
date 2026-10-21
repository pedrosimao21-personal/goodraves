"use server";

import { toIsoDate } from "@/lib/dates";
import { requireAuth } from "./festival-helpers";
import { queryTailoredFestivals, type TailoredResult } from "./tailored-festivals-core";

/** Upper bound on genres per call; the profile stores a short list. */
const MAX_GENRES = 10;

/**
 * "Tailored for you" on the profile: upcoming festivals in the user's
 * favourite genres, near their home city first, not already on their lists
 * (see tailored-festivals-core.ts).
 */
export async function getTailoredFestivals(genres: string[], city: string | null): Promise<TailoredResult> {
  const userId = await requireAuth();
  const cleanGenres = (Array.isArray(genres) ? genres : [])
    .filter((genre): genre is string => typeof genre === "string" && genre.trim().length > 0)
    .map((genre) => genre.trim())
    .slice(0, MAX_GENRES);
  const cleanCity = typeof city === "string" && city.trim() ? city.trim() : null;
  return queryTailoredFestivals(userId, cleanGenres, cleanCity, toIsoDate(new Date()));
}
