"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivalArtists } from "@/db/schema";
import { requireAdmin, enforceRateLimit, deleteB2bSets } from "./festival-helpers";
import { RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_IMAGE_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { fetchFFEventImageUrlCore, fetchFFEventCore } from "./festival-import-ff-core";

/**
 * Fetch only the og:image URL for a FestivalFans.nl event by slug. Called
 * directly from SearchSection for un-imported search-result cards — rate
 * limited under the same "card-image" bucket as the other per-card lookups.
 */
export async function fetchFFEventImageUrl(slug: string): Promise<string | null> {
  await enforceRateLimit("card-image", RATE_LIMIT_IMAGE_MAX, RATE_LIMIT_WINDOW_MS);
  return fetchFFEventImageUrlCore(slug);
}

/** Force-reimport a FestivalFans.nl event (deletes existing lineup first) */
export async function reimportFFEvent(slug: string): Promise<string | null> {
  await requireAdmin();
  if (!slug) return null;
  const festivalId = `ff-${slug}`;

  await deleteB2bSets(festivalId);
  await db.delete(festivalArtists).where(eq(festivalArtists.festivalId, festivalId));

  return fetchFFEventCore(slug, { force: true });
}

/**
 * Fetch a single FestivalFans.nl event by slug and persist to DB. The public
 * entry point: rate-limited per caller on every path that reaches
 * festivalfans.nl, including the "already imported but no image yet"
 * backfill branch inside fetchFFEventCore — not just the full-import case —
 * since that's an external fetch too and was previously free to call
 * unlimited times. Internal callers (festival-data.ts's auto-import/backfill)
 * use fetchFFEventCore directly instead — see festival-import-ff-core.ts's
 * file comment for why that's not just an optimization but a Next.js
 * requirement.
 */
export async function fetchFFEvent(
  slug: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  await enforceRateLimit("import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);
  return fetchFFEventCore(slug, opts);
}
