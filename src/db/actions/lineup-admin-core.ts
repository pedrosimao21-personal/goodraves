import { db } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { artists, festivalArtists, festivalB2bSetMembers, festivalB2bSets, festivalLineupExclusions } from "@/db/schema";
import { foldArtistName } from "@/lib/lineup-name";
import { normalizeArtistName } from "@/utils/text-normalizer";

const MIN_B2B_MEMBERS = 2;

async function fetchArtistName(artistId: string): Promise<string> {
  const [row] = await db.select({ name: artists.name }).from(artists).where(eq(artists.id, artistId)).limit(1);
  if (!row) throw new Error("Artist not found");
  return row.name;
}

/** Remember that imports must skip (or redirect) this name for this festival. */
async function recordExclusion(festivalId: string, name: string, replacedByName: string | null): Promise<void> {
  const nameKey = foldArtistName(normalizeArtistName(name));
  await db
    .insert(festivalLineupExclusions)
    .values({ festivalId, nameKey, replacedByName })
    .onConflictDoUpdate({
      target: [festivalLineupExclusions.festivalId, festivalLineupExclusions.nameKey],
      set: { replacedByName },
    });
}

async function fetchB2bSetIdsOfFestival(festivalId: string): Promise<string[]> {
  const rows = await db.select({ id: festivalB2bSets.id }).from(festivalB2bSets).where(eq(festivalB2bSets.festivalId, festivalId));
  return rows.map((row) => row.id);
}

/** Drop the artist from this festival's B2B sets, and any set left with fewer than two members. */
async function removeFromB2bSets(festivalId: string, artistId: string): Promise<void> {
  const setIds = await fetchB2bSetIdsOfFestival(festivalId);
  if (setIds.length === 0) return;

  const memberships = await db
    .select({ setId: festivalB2bSetMembers.b2bSetId })
    .from(festivalB2bSetMembers)
    .where(and(eq(festivalB2bSetMembers.artistId, artistId), inArray(festivalB2bSetMembers.b2bSetId, setIds)));
  const affectedSetIds = memberships.map((row) => row.setId);
  if (affectedSetIds.length === 0) return;

  await db
    .delete(festivalB2bSetMembers)
    .where(and(eq(festivalB2bSetMembers.artistId, artistId), inArray(festivalB2bSetMembers.b2bSetId, affectedSetIds)));
  await db
    .delete(festivalB2bSets)
    .where(
      and(
        inArray(festivalB2bSets.id, affectedSetIds),
        sql`(SELECT count(*) FROM festival_b2b_set_members m WHERE m.b2b_set_id = ${festivalB2bSets.id}) < ${MIN_B2B_MEMBERS}`
      )
    );
}

/**
 * Take an artist out of one festival: lineup entry, timetable slots, B2B
 * membership, and what users stored against that set (ratings, picks). Recorded
 * as an exclusion so the next import doesn't put it back. The artist itself and
 * its other festivals are untouched. Returns the artist's name.
 */
export async function removeArtistFromLineupCore(festivalId: string, artistId: string): Promise<string> {
  const name = await fetchArtistName(artistId);
  await recordExclusion(festivalId, name, null);

  await removeFromB2bSets(festivalId, artistId);
  await db.execute(sql`DELETE FROM festival_timetable_slots WHERE festival_id = ${festivalId} AND artist_id = ${artistId}`);
  await db.execute(sql`DELETE FROM user_festival_artist_ratings WHERE festival_id = ${festivalId} AND artist_id = ${artistId}`);
  await db.execute(sql`DELETE FROM user_artist_want_to_see WHERE festival_id = ${festivalId} AND artist_id = ${artistId}`);
  await db.delete(festivalArtists).where(and(eq(festivalArtists.festivalId, festivalId), eq(festivalArtists.artistId, artistId)));
  return name;
}

/**
 * Fold a duplicate lineup entry into the artist to keep, for this festival only:
 * users' ratings and picks, timetable slots and B2B membership move across (where
 * the keeper already has its own, the duplicate's is dropped), then the duplicate
 * leaves the lineup and is recorded so imports redirect its name to the keeper.
 * Safe to re-run if interrupted: the lineup entry is removed last. Returns the keeper's name.
 */
export async function mergeLineupArtistsCore(festivalId: string, duplicateId: string, keepId: string): Promise<string> {
  if (duplicateId === keepId) throw new Error("Pick two different artists");
  const [duplicateName, keepName] = await Promise.all([fetchArtistName(duplicateId), fetchArtistName(keepId)]);

  await db.execute(sql`
    UPDATE user_festival_artist_ratings r SET artist_id = ${keepId}
    WHERE r.festival_id = ${festivalId} AND r.artist_id = ${duplicateId}
      AND NOT EXISTS (SELECT 1 FROM user_festival_artist_ratings k WHERE k.user_id = r.user_id AND k.festival_id = ${festivalId} AND k.artist_id = ${keepId})`);
  await db.execute(sql`DELETE FROM user_festival_artist_ratings WHERE festival_id = ${festivalId} AND artist_id = ${duplicateId}`);

  await db.execute(sql`
    UPDATE user_artist_want_to_see w SET artist_id = ${keepId}
    WHERE w.festival_id = ${festivalId} AND w.artist_id = ${duplicateId}
      AND NOT EXISTS (SELECT 1 FROM user_artist_want_to_see k WHERE k.user_id = w.user_id AND k.festival_id = ${festivalId} AND k.artist_id = ${keepId})`);
  await db.execute(sql`DELETE FROM user_artist_want_to_see WHERE festival_id = ${festivalId} AND artist_id = ${duplicateId}`);

  await db.execute(sql`
    UPDATE festival_timetable_slots s SET artist_id = ${keepId}
    WHERE s.festival_id = ${festivalId} AND s.artist_id = ${duplicateId}
      AND NOT EXISTS (
        SELECT 1 FROM festival_timetable_slots k
        WHERE k.festival_id = ${festivalId} AND k.artist_id = ${keepId} AND k.stage_name = s.stage_name
          AND k.start_time IS NOT DISTINCT FROM s.start_time AND k.end_time IS NOT DISTINCT FROM s.end_time AND k.slot_date = s.slot_date)`);
  await db.execute(sql`DELETE FROM festival_timetable_slots WHERE festival_id = ${festivalId} AND artist_id = ${duplicateId}`);

  await db.execute(sql`
    UPDATE festival_b2b_set_members m SET artist_id = ${keepId}
    WHERE m.artist_id = ${duplicateId}
      AND m.b2b_set_id IN (SELECT id FROM festival_b2b_sets WHERE festival_id = ${festivalId})
      AND NOT EXISTS (SELECT 1 FROM festival_b2b_set_members k WHERE k.b2b_set_id = m.b2b_set_id AND k.artist_id = ${keepId})`);
  await removeFromB2bSets(festivalId, duplicateId);

  await db.insert(festivalArtists).values({ festivalId, artistId: keepId }).onConflictDoNothing();
  await recordExclusion(festivalId, duplicateName, keepName);
  await db.delete(festivalArtists).where(and(eq(festivalArtists.festivalId, festivalId), eq(festivalArtists.artistId, duplicateId)));
  return keepName;
}
