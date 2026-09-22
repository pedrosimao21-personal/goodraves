"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./festival-helpers";
import { mergeFestivalsCore } from "./festival-merge-core";
import { isPendingPair, markPairDismissed, type DuplicateCandidate } from "./festival-duplicates-core";

export type { DuplicateCandidate };

const DUPLICATES_PATH = "/admin/duplicates";

function orderedPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/** Admin only: "not the same event" — never suggest this pair again. */
export async function dismissDuplicate(festivalX: string, festivalY: string): Promise<void> {
  await requireAdmin();
  const [a, b] = orderedPair(festivalX, festivalY);
  await markPairDismissed(a, b);
  revalidatePath(DUPLICATES_PATH);
}

/**
 * Admin only: merge a queued pair, keeping `winnerId`. Only pairs actually
 * in the pending queue can be merged through here — this isn't a general
 * "merge any two festivals" endpoint (that's mergeFestivals).
 */
export async function mergeDuplicate(winnerId: string, loserId: string): Promise<void> {
  await requireAdmin();
  const [a, b] = orderedPair(winnerId, loserId);
  if (!(await isPendingPair(a, b))) {
    throw new Error("That pair is not in the review queue");
  }
  // Deleting the loser cascades its festival_duplicate_candidates rows away.
  await mergeFestivalsCore(winnerId, [loserId]);
  revalidatePath(DUPLICATES_PATH);
  revalidatePath(`/festival/${winnerId}`);
  revalidatePath(`/festival/${loserId}`);
}
