import { db } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { artists, festivals, festivalArtists } from "@/db/schema";
import { auth } from "../../../auth";
import { MIN_RATING, MAX_RATING } from "@/lib/constants";

// Re-export shared constants so existing server-side imports keep working
export {
  MAX_QUERY_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_FESTIVAL_NAME_LENGTH,
  SEARCH_CACHE_TTL_MS,
  MIN_RATING,
  MAX_RATING,
} from "@/lib/constants";

/** Verify the session and return the authenticated userId. Throws if not authenticated. */
export async function requireAuth(): Promise<string> {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

/** Clamp a rating to 1-5, or throw if invalid. */
export function validateRating(rating: number): number {
  const rounded = Math.round(rating);
  if (rounded < MIN_RATING || rounded > MAX_RATING || !Number.isFinite(rounded)) {
    throw new Error(`Rating must be between ${MIN_RATING} and ${MAX_RATING}`);
  }
  return rounded;
}

/**
 * Ensure artist names exist in the artists table, then return a name->id map.
 */
export async function ensureArtistsAndGetIds(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {};

  await db
    .insert(artists)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing();

  const rows = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(inArray(artists.name, names));

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.name] = row.id;
  }
  return map;
}

/** Check whether a festival exists and already has at least one lineup entry. */
export async function checkExistingLineup(festivalId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: festivals.id })
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);

  if (!existing) return false;

  const [hasLineup] = await db
    .select({ artistId: festivalArtists.artistId })
    .from(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId))
    .limit(1);

  return !!hasLineup;
}

/** Check whether a festival with the same name and date already exists (from any source). */
export async function findExistingFestivalByNameDate(
  name: string,
  date: string
): Promise<string | null> {
  const [existing] = await db
    .select({ id: festivals.id })
    .from(festivals)
    .where(and(eq(festivals.name, name), eq(festivals.date, date)))
    .limit(1);

  return existing?.id ?? null;
}
