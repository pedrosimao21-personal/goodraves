"use server";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists } from "@/db/schema";
import { requireAdmin, enforceRateLimit, checkExistingLineup, findExistingFestivalByNameDate, deleteB2bSets, backfillMissingImage, persistLineup } from "./festival-helpers";
import { RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { fetchFFEventHtml } from "@/services/festivalfans/client";
import { toIsoDate } from "@/lib/dates";
import { parseFFEventPage } from "@/services/festivalfans/parser";

/** Fetch only the og:image URL for a FestivalFans.nl event by slug. */
export async function fetchFFEventImageUrl(slug: string): Promise<string | null> {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;

  const html = await fetchFFEventHtml(slug);
  if (!html) return null;

  const parsed = parseFFEventPage(html);
  return parsed.imageUrl;
}

/** Force-reimport a FestivalFans.nl event (deletes existing lineup first) */
export async function reimportFFEvent(slug: string): Promise<string | null> {
  await requireAdmin();
  if (!slug) return null;
  const festivalId = `ff-${slug}`;

  await deleteB2bSets(festivalId);

  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));

  return fetchFFEvent(slug, { force: true });
}

/** Fetch a single FestivalFans.nl event by slug and persist to DB */
export async function fetchFFEvent(
  slug: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;

  const festivalId = `ff-${slug}`;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, () => fetchFFEventImageUrl(slug));
      return festivalId;
    }
  }

  // Past this point we hit festivalfans.nl and write a new festival.
  await enforceRateLimit("import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);

  const html = await fetchFFEventHtml(slug);
  if (!html) return null;

  const parsed = parseFFEventPage(html);
  if (!parsed.name) return null;

  const date = parsed.date ?? toIsoDate(new Date());

  const existingId = await findExistingFestivalByNameDate(parsed.name, date);
  if (existingId && existingId !== festivalId) {
    return existingId;
  }

  // On a forced re-import, rebuild the lineup from scratch so dropped artists are
  // removed and B2B sets aren't duplicated. Runs only after a successful fetch and
  // once committed to this festival id. Ratings/attendance survive (they key on
  // (userId, festivalId, artistId), not the lineup join).
  if (opts?.force) {
    await deleteB2bSets(festivalId);
    await db.delete(festivalArtists).where(eq(festivalArtists.festivalId, festivalId));
  }

  const festivalValues = {
    id: festivalId,
    name: parsed.name,
    date,
    endDate: parsed.endDate,
    venue: parsed.venue,
    location: parsed.location,
    source: "festivalfans" as const,
    sourceId: slug,
    imageUrl: parsed.imageUrl,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
  };

  if (opts?.force) {
    await db
      .insert(festivals)
      .values(festivalValues)
      .onConflictDoUpdate({
        target: festivals.id,
        set: {
          name: festivalValues.name,
          date: festivalValues.date,
          endDate: festivalValues.endDate,
          venue: festivalValues.venue,
          location: festivalValues.location,
          imageUrl: festivalValues.imageUrl,
          latitude: festivalValues.latitude,
          longitude: festivalValues.longitude,
          sourceId: festivalValues.sourceId,
        },
      });
  } else {
    await db
      .insert(festivals)
      .values(festivalValues)
      .onConflictDoUpdate({
        target: festivals.id,
        set: {
          endDate: sql`COALESCE(${festivalValues.endDate}, ${festivals.endDate})`,
          imageUrl: sql`COALESCE(${festivalValues.imageUrl}, ${festivals.imageUrl})`,
          latitude: sql`COALESCE(${festivalValues.latitude}, ${festivals.latitude})`,
          longitude: sql`COALESCE(${festivalValues.longitude}, ${festivals.longitude})`,
          sourceId: sql`COALESCE(${festivalValues.sourceId}, ${festivals.sourceId})`,
        },
      });
  }

  await persistLineup(festivalId, parsed.lineup);

  return festivalId;
}
