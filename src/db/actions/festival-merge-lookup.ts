import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivalMerges } from "@/db/schema";

const MAX_MERGE_HOPS = 10;

/**
 * Deliberately no "use server" — a plain lookup shared by the public
 * `getMergeRedirectTarget` action (festival-merge.ts) and every importer.
 *
 * Resolves a possibly-merged festival id to the row it now lives in,
 * following a chain if the winner was itself later merged into a third
 * festival. Returns null if `festivalId` was never a merge loser.
 *
 * Importers call this BEFORE creating a row: a merged-away id like
 * `pf-482747` no longer exists in `festivals`, so without this check the
 * next daily agenda import (or a user re-opening an old RA link) would
 * recreate it, and the daily dedupe would merge it away again, forever.
 */
export async function resolveMergedFestivalId(festivalId: string): Promise<string | null> {
  let current = festivalId;
  const seen = new Set<string>();

  for (let hop = 0; hop < MAX_MERGE_HOPS; hop++) {
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
