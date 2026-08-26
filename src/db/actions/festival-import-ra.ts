"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivalArtists } from "@/db/schema";
import { requireAdmin, enforceRateLimit, deleteB2bSets } from "./festival-helpers";
import { RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_IMAGE_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { fetchRAEventImageUrlCore, fetchRAEventCore } from "./festival-import-ra-core";

/**
 * Fetch only the image URL for an RA event by numeric ID. Called directly
 * from SearchSection for un-imported search-result cards — rate limited
 * under the same "card-image" bucket as the other per-card lookups.
 */
export async function fetchRAEventImageUrl(raId: string): Promise<string | null> {
  await enforceRateLimit("card-image", RATE_LIMIT_IMAGE_MAX, RATE_LIMIT_WINDOW_MS);
  return fetchRAEventImageUrlCore(raId);
}

/** Force-reimport an RA event (deletes existing lineup first) */
export async function reimportRAEvent(eventId: string): Promise<string | null> {
  await requireAdmin();
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;
  const festivalId = `ra-${id}`;

  await deleteB2bSets(festivalId);
  await db.delete(festivalArtists).where(eq(festivalArtists.festivalId, festivalId));

  return fetchRAEventCore(eventId, { force: true });
}

/**
 * Fetch a single RA event by ID from ra.co and persist to DB. The public
 * entry point: rate-limited per caller on every path that reaches ra.co,
 * including the "already imported but no image yet" backfill branch inside
 * fetchRAEventCore — not just the full-import case — since that's an
 * external fetch too and was previously free to call unlimited times.
 * Internal callers (festival-data.ts's auto-import/backfill) use
 * fetchRAEventCore directly instead — see festival-import-ra-core.ts's file
 * comment for why that's not just an optimization but a Next.js requirement.
 */
export async function fetchRAEvent(
  eventId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  await enforceRateLimit("import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);
  return fetchRAEventCore(eventId, opts);
}
