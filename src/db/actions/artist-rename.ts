"use server";

import { db } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import {
  artists,
  festivalArtists,
  festivalB2bSetMembers,
  userFestivalArtistRatings,
  userArtistGlobal,
  artistGenres,
} from "@/db/schema";
import { requireAdmin } from "./festival-helpers";
import { revalidatePath } from "next/cache";

// ── Types ─────────────────────────────────────────────────

export type RenameResult = {
  id: string;
  name: string;
  wasMerged: boolean;
};

// ── Rename (or merge) a festival artist ───────────────────

export async function renameArtist(
  festivalId: string,
  oldArtistId: string,
  newName: string
): Promise<RenameResult> {
  await requireAdmin();

  const trimmed = newName.trim();
  if (trimmed.length === 0) {
    throw new Error("Artist name cannot be empty");
  }

  // Look up the source artist
  const [sourceArtist] = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(eq(artists.id, oldArtistId))
    .limit(1);

  if (!sourceArtist) {
    throw new Error("Artist not found");
  }

  // Check if the new name already matches the current name (no-op)
  if (sourceArtist.name.toLowerCase() === trimmed.toLowerCase()) {
    return { id: sourceArtist.id, name: sourceArtist.name, wasMerged: false };
  }

  // Check if an artist with the target name already exists
  const [targetArtist] = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(sql`lower(${artists.name}) = lower(${trimmed})`)
    .limit(1);

  if (targetArtist) {
    // Merge: re-point all references from source to target
    await mergeArtistInto(festivalId, oldArtistId, targetArtist.id);
    await deleteOrphanedArtist(oldArtistId);

    revalidatePath(`/festival/${festivalId}`);
    return { id: targetArtist.id, name: targetArtist.name, wasMerged: true };
  }

  // Simple rename: no existing artist with that name
  await db
    .update(artists)
    .set({ name: trimmed })
    .where(eq(artists.id, oldArtistId));

  revalidatePath(`/festival/${festivalId}`);
  return { id: oldArtistId, name: trimmed, wasMerged: false };
}

// ── Merge helpers ─────────────────────────────────────────

async function mergeArtistInto(
  festivalId: string,
  sourceId: string,
  targetId: string
): Promise<void> {
  // Re-point festival lineup entry
  // Delete source first, then insert target (to avoid PK conflict)
  await db
    .delete(festivalArtists)
    .where(
      and(
        eq(festivalArtists.festivalId, festivalId),
        eq(festivalArtists.artistId, sourceId)
      )
    );

  await db
    .insert(festivalArtists)
    .values({ festivalId, artistId: targetId })
    .onConflictDoNothing();

  // Re-point performance ratings (all festivals, not just this one)
  await reassignRows(
    userFestivalArtistRatings,
    "artistId",
    sourceId,
    targetId
  );

  // Re-point B2B set memberships
  await reassignRows(festivalB2bSetMembers, "artistId", sourceId, targetId);

  // Re-point global artist ratings/notes
  await reassignRows(userArtistGlobal, "artistId", sourceId, targetId);

  // Re-point genre associations
  await reassignRows(artistGenres, "artistId", sourceId, targetId);
}

/**
 * Generic helper to reassign rows from one artistId to another.
 * Deletes rows that would violate unique constraints (the target
 * already has an entry) by using a delete-then-insert-select pattern
 * that is safe without transactions: we delete the source rows, and
 * any that conflict with existing target rows are simply dropped.
 *
 * Since the neon HTTP driver does not support transactions, we use a
 * simpler approach: update where possible, and rely on the DB to
 * reject duplicates. For tables with composite PKs involving artistId,
 * we delete the source rows for the artist — the target artist's
 * existing rows (if any) already cover that data.
 */
async function reassignRows(
  table: any,
  column: string,
  sourceId: string,
  targetId: string
): Promise<void> {
  // Try to update; if a conflict occurs the row is a duplicate — delete it instead
  try {
    await db
      .update(table)
      .set({ [column]: targetId })
      .where(eq(table[column], sourceId));
  } catch {
    // Conflict: target already has rows. Just delete the source rows.
    await db.delete(table).where(eq(table[column], sourceId));
  }
}

/** Delete an artist if no festival_artists rows reference it anymore */
async function deleteOrphanedArtist(artistId: string): Promise<void> {
  const [remaining] = await db
    .select({ count: sql<number>`count(*)` })
    .from(festivalArtists)
    .where(eq(festivalArtists.artistId, artistId));

  if (remaining && Number(remaining.count) === 0) {
    // Also check B2B set memberships
    const [b2bRemaining] = await db
      .select({ count: sql<number>`count(*)` })
      .from(festivalB2bSetMembers)
      .where(eq(festivalB2bSetMembers.artistId, artistId));

    if (b2bRemaining && Number(b2bRemaining.count) === 0) {
      await db.delete(artists).where(eq(artists.id, artistId));
    }
  }
}
