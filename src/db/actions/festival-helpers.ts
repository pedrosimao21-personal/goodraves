import { db } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { artists, festivals, festivalArtists, festivalB2bSets, festivalB2bSetMembers, users } from "@/db/schema";
import { auth } from "../../../auth";
import { MIN_RATING, MAX_RATING } from "@/lib/constants";
import { isRateLimited } from "@/db/rate-limit";
import { type B2bLineupEntry } from "@/services/lineup-types";
import { normalizeArtistName } from "@/utils/text-normalizer";

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
  const userId = await getOptionalUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

/**
 * Return the authenticated userId, or null if there is no session.
 * Use this (instead of requireAuth) where logged-out access is valid and should
 * resolve to "no user" rather than throw — e.g. SSR hydration of optional data.
 */
export async function getOptionalUserId(): Promise<string | null> {
  const session = await auth();
  return ((session?.user as any)?.id as string | undefined) ?? null;
}

/** Verify the session and return the authenticated userId. Throws if not an admin user. */
export async function requireAdmin(): Promise<string> {
  const userId = await getOptionalUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row?.isAdmin) {
    throw new Error("Forbidden");
  }
  return userId;
}

/**
 * Enforce a per-caller rate limit on a server action. Identifies the caller by
 * userId when authenticated, falling back to the request IP for public actions.
 * Throws a user-facing error when the limit is exceeded.
 */
export async function enforceRateLimit(
  action: string,
  maxAttempts: number,
  windowMs: number
): Promise<void> {
  const userId = await getOptionalUserId();
  let identifier = userId ? `user:${userId}` : null;
  if (!identifier) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
    identifier = `ip:${ip || "unknown"}`;
  }
  if (await isRateLimited(identifier, action, maxAttempts, windowMs)) {
    throw new Error("Too many requests. Please slow down and try again shortly.");
  }
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
 * Applies NFC normalization and entity decoding as a safety net.
 */
export async function ensureArtistsAndGetIds(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {};

  const normalizedNames = names.map(normalizeArtistName).filter((n) => n.length > 0);
  if (normalizedNames.length === 0) return {};

  await db
    .insert(artists)
    .values(normalizedNames.map((name) => ({ name })))
    .onConflictDoNothing();

  const lowerNames = normalizedNames.map((n) => n.toLowerCase());
  const rows = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(inArray(sql`lower(${artists.name})`, lowerNames));

  const map: Record<string, string> = {};
  for (const row of rows) {
    // Map by the original input name (case-preserving) so callers can look up
    // using the exact string they provided, even when the DB stores
    // a different casing.
    const inputName = names.find(
      (n) => normalizeArtistName(n).toLowerCase() === row.name.toLowerCase()
    );
    if (inputName) {
      map[inputName] = row.id;
    }
    // Also map by the stored name for direct lookups
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

/**
 * Create B2B set records for a festival from parsed b2b lineup entries.
 * Each entry creates a `festivalB2bSets` row and corresponding member rows.
 */
export async function createB2bSets(
  festivalId: string,
  b2bEntries: B2bLineupEntry[],
  nameToId: Record<string, string>
): Promise<void> {
  for (const entry of b2bEntries) {
    const memberIds = entry.members
      .map((name) => nameToId[name])
      .filter(Boolean);

    if (memberIds.length < 2) continue;

    const [b2bSet] = await db
      .insert(festivalB2bSets)
      .values({ festivalId, originalArtistName: entry.originalName })
      .returning({ id: festivalB2bSets.id });

    const memberInserts = memberIds.map((artistId, idx) => ({
      b2bSetId: b2bSet.id,
      artistId,
      position: idx,
    }));
    await db.insert(festivalB2bSetMembers).values(memberInserts);
  }
}

/** Delete all B2B sets (and cascading members) for a festival. */
export async function deleteB2bSets(festivalId: string): Promise<void> {
  await db
    .delete(festivalB2bSets)
    .where(eq(festivalB2bSets.festivalId, festivalId));
}
