"use server";

import { requireAdmin, enforceRateLimit, checkExistingLineup, backfillMissingImage } from "./festival-helpers";
import { RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_IMAGE_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { fetchPFEventImageUrlCore, clearPFFestivalRelations, importPFEventCore } from "./festival-import-pf-core";

/**
 * Fetch only the og:image URL for a Partyflock event by party ID. Called
 * directly from SearchSection for un-imported search-result cards — rate
 * limited under the same "card-image" bucket as the other per-card lookups.
 */
export async function fetchPFEventImageUrl(partyId: string): Promise<string | null> {
  await enforceRateLimit("card-image", RATE_LIMIT_IMAGE_MAX, RATE_LIMIT_WINDOW_MS);
  return fetchPFEventImageUrlCore(partyId);
}

/** Force-reimport a Partyflock event (deletes existing lineup first). */
export async function reimportPFEvent(partyId: string): Promise<string | null> {
  await requireAdmin();
  if (!partyId) return null;
  const festivalId = `pf-${partyId}`;

  await clearPFFestivalRelations(festivalId);

  return fetchPFEvent(partyId, { force: true });
}

/**
 * Fetch a single Partyflock event by party ID and persist to DB. The public
 * entry point: rate-limited per caller on every path that reaches
 * partyflock.nl, including the "already imported but no image yet" backfill
 * branch below — not just the full-import branch — since that branch is an
 * external fetch too and was previously free to call unlimited times.
 * Internal callers (scripts/cron) should use `importPFEvent`
 * (festival-import-pf-core.ts) instead to avoid the request-scoped rate limit.
 */
export async function fetchPFEvent(
  partyId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;

  const festivalId = `pf-${partyId}`;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await enforceRateLimit("import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);
      await backfillMissingImage(festivalId, () => fetchPFEventImageUrlCore(partyId));
      return festivalId;
    }
  }

  // Past this point we hit partyflock.nl and write a new festival.
  await enforceRateLimit("import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);

  return importPFEventCore(partyId, festivalId, opts);
}
