import { db } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { artists, festivalArtists, festivalTimetableSlots } from "@/db/schema";
import { ensureArtistsAndGetIds, insertTimetableSlots } from "./festival-helpers";
import { canonicalizeLineupIds } from "./lineup-canonical";
import type { TimetableSlot } from "@/services/lineup-types";

/**
 * Deliberately no "use server" — only called by the scheduled timetable
 * refresh (festival-timetable-refresh.ts), which runs with no user session.
 *
 * If a fresh timetable has fewer than this fraction of the slots we already
 * store for that day, it's far more likely a partial page or parser drift
 * than Partyflock really cancelling half the sets. Leave the day untouched
 * and report it instead.
 */
const MIN_KEPT_SLOT_FRACTION = 0.5;

export type TimetableSyncStatus = "unchanged" | "updated" | "skipped-shrink";

export type TimetableSyncResult = {
  status: TimetableSyncStatus;
  added: number;
  removed: number;
};

/** Case-insensitive name → id for artists that already exist (no inserts). */
async function lookupExistingArtistIds(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {};
  const lowered = names.map((n) => n.toLowerCase());
  const rows = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(sql`lower(${artists.name}) IN (${sql.join(lowered.map((n) => sql`${n}`), sql`, `)})`);
  const idByLower = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
  return Object.fromEntries(names.filter((n) => idByLower.has(n.toLowerCase())).map((n) => [n, idByLower.get(n.toLowerCase())!]));
}

function slotKey(artistId: string, stageName: string, startTime: string, endTime: string): string {
  return `${artistId}|${stageName}|${startTime}|${endTime}`;
}

/**
 * Bring one festival day's stored timetable in line with a freshly fetched
 * one: add new/moved slots, then drop the ones that no longer exist (a set
 * whose time changed leaves its old row behind otherwise, since slot rows
 * are keyed on their times). New slots are inserted BEFORE stale ones are
 * deleted, so the day is never empty mid-sync (neon-http has no
 * transactions). Timetable artists missing from the lineup are added to it,
 * same as the admin "Link Partyflock Timetable" import.
 *
 * Callers must only pass a non-empty timetable from a successful fetch —
 * this never interprets "nothing fetched" as "clear the day".
 */
export async function syncTimetableDay(
  festivalId: string,
  slotDate: string,
  slots: TimetableSlot[],
  opts: { dryRun?: boolean } = {}
): Promise<TimetableSyncResult> {
  const artistNames = [...new Set(slots.map((slot) => slot.artistName))];
  // A dry run must not create artist rows either, so it can only compare
  // slots of artists that already exist (new names count as "added").
  const nameToId = opts.dryRun
    ? await lookupExistingArtistIds(artistNames)
    : await canonicalizeLineupIds(festivalId, artistNames, await ensureArtistsAndGetIds(artistNames));
  const newNameCount = artistNames.filter((name) => !nameToId[name]).length;

  const freshKeys = new Set(
    slots
      .filter((slot) => nameToId[slot.artistName])
      .map((slot) => slotKey(nameToId[slot.artistName], slot.stageName, slot.startTime, slot.endTime))
  );

  const existing = await db
    .select({
      id: festivalTimetableSlots.id,
      artistId: festivalTimetableSlots.artistId,
      stageName: festivalTimetableSlots.stageName,
      startTime: festivalTimetableSlots.startTime,
      endTime: festivalTimetableSlots.endTime,
    })
    .from(festivalTimetableSlots)
    .where(and(eq(festivalTimetableSlots.festivalId, festivalId), eq(festivalTimetableSlots.slotDate, slotDate)));

  const existingKeys = new Set(existing.map((r) => slotKey(r.artistId, r.stageName, r.startTime, r.endTime)));
  const added = [...freshKeys].filter((key) => !existingKeys.has(key)).length + (opts.dryRun ? newNameCount : 0);
  const staleIds = existing
    .filter((r) => !freshKeys.has(slotKey(r.artistId, r.stageName, r.startTime, r.endTime)))
    .map((r) => r.id);

  if (added === 0 && staleIds.length === 0) {
    return { status: "unchanged", added: 0, removed: 0 };
  }
  if (existing.length > 0 && freshKeys.size < existing.length * MIN_KEPT_SLOT_FRACTION) {
    return { status: "skipped-shrink", added: 0, removed: 0 };
  }
  if (opts.dryRun) return { status: "updated", added, removed: staleIds.length };

  const lineupRows = artistNames
    .filter((name) => nameToId[name])
    .map((name) => ({ festivalId, artistId: nameToId[name] }));
  if (lineupRows.length > 0) {
    await db.insert(festivalArtists).values(lineupRows).onConflictDoNothing();
  }

  await insertTimetableSlots(festivalId, slots, nameToId, slotDate);
  if (staleIds.length > 0) {
    await db.delete(festivalTimetableSlots).where(inArray(festivalTimetableSlots.id, staleIds));
  }

  return { status: "updated", added, removed: staleIds.length };
}
