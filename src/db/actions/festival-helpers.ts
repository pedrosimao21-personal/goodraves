import { db } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/client-ip";
import { artists, festivals, festivalArtists, festivalB2bSets, festivalB2bSetMembers, festivalTimetableSlots, users } from "@/db/schema";
import { auth } from "../../../auth";
import { MIN_RATING, MAX_RATING } from "@/lib/constants";
import { isRateLimited } from "@/db/rate-limit";
import { type B2bLineupEntry, type LineupEntry, type TimetableSlot, flattenLineupNames, filterB2bEntries } from "@/services/lineup-types";
import { normalizeArtistName } from "@/utils/text-normalizer";
import { extractPFPartyId, fetchPFEventHtml } from "@/services/partyflock/client";
import { parsePFEventPage } from "@/services/partyflock/parser";

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
    identifier = `ip:${getClientIp(await headers())}`;
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
  const validEntries = b2bEntries
    .map((entry) => ({
      entry,
      memberIds: entry.members.map((name) => nameToId[name]).filter(Boolean),
    }))
    .filter(({ memberIds }) => memberIds.length >= 2);

  if (validEntries.length === 0) return;

  // Single multi-row insert, relying on Postgres preserving RETURNING order
  // for a plain (no ON CONFLICT) multi-row INSERT to zip ids back to entries.
  const b2bSetRows = await db
    .insert(festivalB2bSets)
    .values(validEntries.map(({ entry }) => ({ festivalId, originalArtistName: entry.originalName })))
    .returning({ id: festivalB2bSets.id });

  const memberInserts = validEntries.flatMap(({ memberIds }, i) =>
    memberIds.map((artistId, idx) => ({ b2bSetId: b2bSetRows[i].id, artistId, position: idx }))
  );

  if (memberInserts.length > 0) {
    await db.insert(festivalB2bSetMembers).values(memberInserts);
  }
}

/** Delete all B2B sets (and cascading members) for a festival. */
export async function deleteB2bSets(festivalId: string): Promise<void> {
  await db
    .delete(festivalB2bSets)
    .where(eq(festivalB2bSets.festivalId, festivalId));
}

/**
 * Backfill a festival's image when it was imported without one. Reads the
 * current row, and only if it has no image calls `fetchImageUrl` (the
 * source-specific fetch) and stores the result. Shared by every importer's
 * "already exists, just top up the image" path.
 */
export async function backfillMissingImage(
  festivalId: string,
  fetchImageUrl: () => Promise<string | null>
): Promise<void> {
  const [row] = await db
    .select({ imageUrl: festivals.imageUrl })
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);

  if (row?.imageUrl) return;

  const imageUrl = await fetchImageUrl();
  if (!imageUrl) return;

  await db
    .update(festivals)
    .set({ imageUrl })
    .where(eq(festivals.id, festivalId));
}

/**
 * Persist a festival's lineup: ensure the artists exist, link them to the
 * festival, and create any B2B sets. Returns the name→artistId map so callers
 * can do source-specific follow-up work (e.g. RA's ra_artist_id backfill, PF's
 * timetable slots) without re-querying. Assumes any prior lineup was already
 * cleared by the caller on a forced re-import.
 */
export async function persistLineup(
  festivalId: string,
  lineupEntries: LineupEntry[]
): Promise<Record<string, string>> {
  const allNames = flattenLineupNames(lineupEntries);
  if (allNames.length === 0) return {};

  const nameToId = await ensureArtistsAndGetIds(allNames);

  const rows = allNames
    .filter((name) => nameToId[name])
    .map((name) => ({ festivalId, artistId: nameToId[name] }));
  if (rows.length > 0) {
    await db.insert(festivalArtists).values(rows).onConflictDoNothing();
  }

  const b2bEntries = filterB2bEntries(lineupEntries);
  if (b2bEntries.length > 0) {
    await createB2bSets(festivalId, b2bEntries, nameToId);
  }

  return nameToId;
}

export type PFTimetableImportResult = {
  stageCount: number;
  slotCount: number;
  newArtistCount: number;
};

/**
 * Core Partyflock-timetable-import logic: fetch, verify, and persist. Shared
 * by the admin server action (auth-gated — see festival-timetable-import.ts)
 * and the backfill script (runs outside a request context, so it can't call
 * requireAdmin/enforceRateLimit; that's a plain script run by the site owner
 * with direct DATABASE_URL access, the same trust level as the other
 * scripts in ./scripts).
 *
 * Verifies the Partyflock page's date matches the festival's stored date
 * before importing, so a Partyflock series/event page (which can resolve to
 * whichever edition PF currently considers current) can't silently attach
 * the wrong timetable. Artists in the Partyflock timetable that aren't
 * already in the lineup are created and added to it — case-insensitively
 * matched via ensureArtistsAndGetIds, so e.g. Partyflock's "Dax J" resolves
 * to the same artist as an existing RA-sourced "DAX J" row.
 */
export async function importPFTimetable(
  festivalId: string,
  partyflockUrl: string
): Promise<PFTimetableImportResult> {
  const [festival] = await db
    .select({ id: festivals.id, date: festivals.date })
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);
  if (!festival) {
    throw new Error("Festival not found");
  }

  const partyId = await extractPFPartyId(partyflockUrl);
  if (!partyId) {
    throw new Error("Could not resolve a Partyflock party from that URL");
  }

  const html = await fetchPFEventHtml(partyId);
  if (!html) {
    throw new Error("Failed to fetch the Partyflock page");
  }

  const parsed = parsePFEventPage(html);
  if (!parsed.date) {
    throw new Error("Partyflock page has no date to verify against");
  }
  if (parsed.date !== festival.date) {
    throw new Error(
      `Partyflock date (${parsed.date}) doesn't match this festival's date (${festival.date}) — refusing to import a possibly wrong edition.`
    );
  }
  if (parsed.timetable.length === 0) {
    throw new Error("Partyflock page has no timetable to import");
  }

  const existingLineup = await db
    .select({ artistId: festivalArtists.artistId })
    .from(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));
  const existingArtistIds = new Set(existingLineup.map((r) => r.artistId));

  const artistNames = [...new Set(parsed.timetable.map((slot) => slot.artistName))];
  const nameToId = await ensureArtistsAndGetIds(artistNames);

  const lineupRows = artistNames
    .filter((name) => nameToId[name])
    .map((name) => ({ festivalId, artistId: nameToId[name] }));
  const newArtistCount = lineupRows.filter((r) => !existingArtistIds.has(r.artistId)).length;

  if (lineupRows.length > 0) {
    await db.insert(festivalArtists).values(lineupRows).onConflictDoNothing();
  }

  await insertTimetableSlots(festivalId, parsed.timetable, nameToId);

  await db
    .update(festivals)
    .set({ pfPartyId: partyId })
    .where(eq(festivals.id, festivalId));

  return {
    stageCount: new Set(parsed.timetable.map((slot) => slot.stageOrder)).size,
    slotCount: parsed.timetable.length,
    newArtistCount,
  };
}

/** Insert timetable slots for a festival, mapping artist names to IDs. */
export async function insertTimetableSlots(
  festivalId: string,
  slots: TimetableSlot[],
  nameToId: Record<string, string>
): Promise<void> {
  const rows = slots
    .filter((slot) => nameToId[slot.artistName])
    .map((slot) => ({
      festivalId,
      artistId: nameToId[slot.artistName],
      stageName: slot.stageName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      stageOrder: slot.stageOrder,
      slotOrder: slot.slotOrder,
    }));

  if (rows.length === 0) return;

  await db
    .insert(festivalTimetableSlots)
    .values(rows)
    .onConflictDoNothing();
}
