"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivalMerges } from "@/db/schema";
import { requireAdmin } from "./festival-helpers";
import { mergeFestivalsCore, type MergeResult } from "./festival-merge-core";

export type { MergeResult };

/**
 * Admin-gated entry point — see `mergeFestivalsCore` (festival-merge-core.ts)
 * for the actual logic. Scripts (e.g. scripts/dedupe-festivals.ts) run
 * outside a request context and can't call `requireAdmin`, so they import
 * mergeFestivalsCore directly from that file instead of going through here.
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
