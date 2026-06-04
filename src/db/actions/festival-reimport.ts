"use server";

import { requireAdmin } from "./festival-helpers";
import { reimportRAEvent } from "./festival-import-ra";
import { reimportFFEvent } from "./festival-import-ff";
import { reimportPFEvent } from "./festival-import-pf";

/**
 * Admin-only action: re-import a festival's lineup from its source.
 *
 * Clears the existing lineup (including B2B sets) and re-fetches from
 * RA, FestivalFans, or Partyflock depending on the festival ID prefix.
 *
 * Returns the festival ID on success, or null if the import produced no result.
 * Throws if the caller is not an admin or the prefix is unsupported.
 */
export async function reimportFestival(festivalId: string): Promise<string | null> {
  await requireAdmin();

  if (festivalId.startsWith("ra-")) {
    const rawId = festivalId.replace(/^ra-/, "");
    return reimportRAEvent(rawId);
  }

  if (festivalId.startsWith("ff-")) {
    const slug = festivalId.replace(/^ff-/, "");
    return reimportFFEvent(slug);
  }

  if (festivalId.startsWith("pf-")) {
    const partyId = festivalId.replace(/^pf-/, "");
    return reimportPFEvent(partyId);
  }

  throw new Error(`Unsupported festival source for ID: ${festivalId}`);
}
