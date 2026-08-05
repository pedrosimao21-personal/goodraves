"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import {
  festivals,
  festivalArtists,
  festivalTimetableSlots,
  festivalGenres,
  festivalB2bSets,
  festivalB2bSetMembers,
  userFestivals,
  userFestivalArtistRatings,
  festivalMerges,
} from "@/db/schema";
import { requireAdmin } from "./festival-helpers";
import {
  copyLineup,
  copyTimetableSlots,
  copyGenres,
  copyB2bSets,
  copyUserFestivals,
  copyUserFestivalArtistRatings,
} from "./festival-merge-copy";

type FestivalRow = typeof festivals.$inferSelect;

export type MergeResult = {
  winnerId: string;
  mergedLoserIds: string[];
  skippedLoserIds: string[];
};

/**
 * Admin-gated entry point — see `mergeFestivalsCore` for the actual logic.
 * Scripts (e.g. scripts/dedupe-festivals.ts) run outside a request context
 * and can't call `requireAdmin`, so they call the core function directly,
 * the same pattern as `importPFTimetable`/`importPFTimetableForFestival`.
 */
export async function mergeFestivals(winnerId: string, loserIds: string[]): Promise<MergeResult> {
  await requireAdmin();
  const result = await mergeFestivalsCore(winnerId, loserIds);
  revalidatePath(`/festival/${winnerId}`);
  for (const loserId of result.mergedLoserIds) {
    revalidatePath(`/festival/${loserId}`);
  }
  return result;
}

/**
 * Hard-merges `loserIds` into `winnerId`: copies lineup, timetable, genres,
 * B2B sets, and user attendance/ratings onto the winner, then deletes the
 * loser rows. See src/db/schema.ts's `festivalMerges` comment for why this
 * is auditable/redirectable rather than a silent delete.
 *
 * The neon-http driver has no transactions (src/db/index.ts), so this is a
 * sequence of independently-committed statements ordered so a failure
 * partway through is safe to retry: every copy step is additive
 * (ON CONFLICT DO NOTHING or an explicit collision-merge, never a blind
 * overwrite) and re-running them is a no-op for anything already copied.
 * The loser is deleted only after its snapshot is recorded and all its
 * children are copied; the winner's own date/metadata backfill runs LAST,
 * after every loser is gone, so it can never collide with
 * `festivals_name_date_idx` while a loser still holds the target (name, date).
 */
export async function mergeFestivalsCore(winnerId: string, loserIds: string[]): Promise<MergeResult> {
  const uniqueLoserIds = [...new Set(loserIds)].filter((id) => id !== winnerId);
  if (uniqueLoserIds.length === 0) {
    return { winnerId, mergedLoserIds: [], skippedLoserIds: loserIds };
  }

  const [winner] = await db.select().from(festivals).where(eq(festivals.id, winnerId)).limit(1);
  if (!winner) {
    throw new Error(`Winner festival ${winnerId} not found`);
  }

  const loserRows = await db.select().from(festivals).where(inArray(festivals.id, uniqueLoserIds));
  const loserById = new Map(loserRows.map((r) => [r.id, r]));

  const mergedLoserIds: string[] = [];
  const skippedLoserIds = uniqueLoserIds.filter((id) => !loserById.has(id));
  const allDates: string[] = [winner.date, ...(winner.endDate ? [winner.endDate] : [])];
  let metadataDonor = winner;

  for (const loserId of uniqueLoserIds) {
    const loser = loserById.get(loserId);
    if (!loser) continue; // already gone (e.g. a previous partial run) — nothing to do

    allDates.push(loser.date);
    if (loser.endDate) allDates.push(loser.endDate);
    if (isMoreComplete(loser, metadataDonor)) metadataDonor = loser;

    await recordMergeSnapshot(loserId, winnerId, loser);

    await copyLineup(loserId, winnerId);
    await copyTimetableSlots(loserId, winnerId);
    await copyGenres(loserId, winnerId);
    await copyB2bSets(loserId, winnerId);
    await copyUserFestivals(loserId, winnerId);
    await copyUserFestivalArtistRatings(loserId, winnerId);

    // Cascades take festival_artists/timetable_slots/genres/b2b_sets/
    // user_festivals/user_festival_artist_ratings with it — all already
    // copied above.
    await db.delete(festivals).where(eq(festivals.id, loserId));

    mergedLoserIds.push(loserId);
  }

  if (mergedLoserIds.length > 0) {
    await backfillWinnerMetadata(winnerId, allDates, metadataDonor, winner);
  }

  return { winnerId, mergedLoserIds, skippedLoserIds };
}

/** Prefer the row with more of the "nice to have" metadata filled in. */
function isMoreComplete(candidate: FestivalRow, current: FestivalRow): boolean {
  const score = (r: FestivalRow) =>
    (r.imageUrl ? 1 : 0) + (r.venue ? 1 : 0) + (r.countryCode ? 1 : 0) + (r.latitude !== null ? 1 : 0);
  return score(candidate) > score(current);
}

/**
 * Records the loser's full state — its own row plus every child table — as
 * JSON before it's deleted, so an old `/festival/<loserId>` URL can redirect
 * (see getMergeRedirectTarget) and a wrong auto-merge is reconstructable.
 */
async function recordMergeSnapshot(loserId: string, winnerId: string, loser: FestivalRow): Promise<void> {
  const [lineup, timetableSlots, genreLinks, b2bSets, attendance, artistRatings] = await Promise.all([
    db.select().from(festivalArtists).where(eq(festivalArtists.festivalId, loserId)),
    db.select().from(festivalTimetableSlots).where(eq(festivalTimetableSlots.festivalId, loserId)),
    db.select().from(festivalGenres).where(eq(festivalGenres.festivalId, loserId)),
    db.select().from(festivalB2bSets).where(eq(festivalB2bSets.festivalId, loserId)),
    db.select().from(userFestivals).where(eq(userFestivals.festivalId, loserId)),
    db.select().from(userFestivalArtistRatings).where(eq(userFestivalArtistRatings.festivalId, loserId)),
  ]);

  const b2bSetIds = b2bSets.map((s) => s.id);
  const b2bMembers = b2bSetIds.length
    ? await db.select().from(festivalB2bSetMembers).where(inArray(festivalB2bSetMembers.b2bSetId, b2bSetIds))
    : [];

  const snapshot = JSON.stringify({
    festival: loser,
    lineup,
    timetableSlots,
    genreLinks,
    b2bSets,
    b2bMembers,
    attendance,
    artistRatings,
  });

  await db
    .insert(festivalMerges)
    .values({ loserId, winnerId, snapshot })
    .onConflictDoUpdate({
      target: festivalMerges.loserId,
      set: { winnerId, snapshot, mergedAt: new Date() },
    });
}

/**
 * Sets the winner's date range to span every merged member, and backfills
 * any metadata field the winner itself is missing from the most-complete
 * member. Runs only after every loser is deleted (see mergeFestivals).
 */
async function backfillWinnerMetadata(
  winnerId: string,
  allDates: string[],
  donor: FestivalRow,
  currentWinner: FestivalRow
): Promise<void> {
  const sortedDates = [...allDates].sort();
  const date = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  await db
    .update(festivals)
    .set({
      date,
      endDate: endDate !== date ? endDate : currentWinner.endDate,
      venue: currentWinner.venue ?? donor.venue,
      location: currentWinner.location ?? donor.location,
      countryCode: currentWinner.countryCode ?? donor.countryCode,
      countryName: currentWinner.countryName ?? donor.countryName,
      imageUrl: currentWinner.imageUrl ?? donor.imageUrl,
      latitude: currentWinner.latitude ?? donor.latitude,
      longitude: currentWinner.longitude ?? donor.longitude,
    })
    .where(eq(festivals.id, winnerId));
}

/**
 * Resolves a possibly-merged festival id to where it should redirect to —
 * following a chain if the winner was itself later merged into a third
 * festival. Returns null if `festivalId` was never a merge loser.
 */
export async function getMergeRedirectTarget(festivalId: string): Promise<string | null> {
  let current = festivalId;
  const seen = new Set<string>();

  for (let hop = 0; hop < 10; hop++) {
    if (seen.has(current)) return null; // defensive cycle guard
    seen.add(current);

    const [row] = await db
      .select({ winnerId: festivalMerges.winnerId })
      .from(festivalMerges)
      .where(eq(festivalMerges.loserId, current))
      .limit(1);
    if (!row) return current === festivalId ? null : current;

    current = row.winnerId;
  }

  return current;
}
