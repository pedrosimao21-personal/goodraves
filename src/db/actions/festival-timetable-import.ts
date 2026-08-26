"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  requireAdmin,
  enforceRateLimit,
  importPFTimetable,
  timetableCacheTag,
  type PFTimetableImportResult,
} from "./festival-helpers";
import { RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export type { PFTimetableImportResult };

/**
 * Admin-only: link a festival to a Partyflock party and import its timetable.
 * Used for festivals whose own source (RA/FestivalFans) has a lineup but no
 * per-stage schedule. See importPFTimetable (festival-helpers.ts) for the
 * shared core logic, also used by the scripts/link-pf-timetables.ts backfill.
 */
export async function importPFTimetableForFestival(
  festivalId: string,
  partyflockUrl: string
): Promise<PFTimetableImportResult> {
  await requireAdmin();
  await enforceRateLimit("pf-timetable-import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);

  const result = await importPFTimetable(festivalId, partyflockUrl);
  revalidatePath(`/festival/${festivalId}`);
  revalidateTag(timetableCacheTag(festivalId));
  return result;
}
