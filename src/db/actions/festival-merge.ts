"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./festival-helpers";
import { mergeFestivalsCore, type MergeResult } from "./festival-merge-core";
import { resolveMergedFestivalId } from "./festival-merge-lookup";

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
  return resolveMergedFestivalId(festivalId);
}
