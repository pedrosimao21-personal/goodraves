"use server";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists } from "@/db/schema";
import { ensureArtistsAndGetIds, checkExistingLineup, findExistingFestivalByNameDate } from "./festival-helpers";
import { fetchFFEventHtml } from "@/services/festivalfans/client";
import { parseFFEventPage } from "@/services/festivalfans/parser";

/** Fetch and store imageUrl for a festival that was imported without one. */
async function backfillMissingImage(festivalId: string, slug: string): Promise<void> {
  const [row] = await db
    .select({ imageUrl: festivals.imageUrl })
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);

  if (row?.imageUrl) return;

  const html = await fetchFFEventHtml(slug);
  if (!html) return;

  const parsed = parseFFEventPage(html);
  if (!parsed.imageUrl) return;

  await db
    .update(festivals)
    .set({ imageUrl: parsed.imageUrl })
    .where(eq(festivals.id, festivalId));
}

/** Force-reimport a FestivalFans.nl event (deletes existing lineup first) */
export async function reimportFFEvent(slug: string): Promise<string | null> {
  if (!slug) return null;
  const festivalId = `ff-${slug}`;

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
      await backfillMissingImage(festivalId, slug);
      return festivalId;
    }
  }

  const html = await fetchFFEventHtml(slug);
  if (!html) return null;

  const parsed = parseFFEventPage(html);
  if (!parsed.name) return null;

  const date = parsed.date ?? new Date().toISOString().slice(0, 10);

  const existingId = await findExistingFestivalByNameDate(parsed.name, date);
  if (existingId && existingId !== festivalId) {
    return existingId;
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
        },
      });
  } else {
    await db
      .insert(festivals)
      .values(festivalValues)
      .onConflictDoUpdate({
        target: festivals.id,
        set: {
          imageUrl: sql`COALESCE(${festivalValues.imageUrl}, ${festivals.imageUrl})`,
          latitude: sql`COALESCE(${festivalValues.latitude}, ${festivals.latitude})`,
          longitude: sql`COALESCE(${festivalValues.longitude}, ${festivals.longitude})`,
        },
      });
  }

  if (parsed.lineup.length > 0) {
    const nameToId = await ensureArtistsAndGetIds(parsed.lineup);
    await db
      .insert(festivalArtists)
      .values(
        parsed.lineup
          .filter((name) => nameToId[name])
          .map((name) => ({ festivalId, artistId: nameToId[name] }))
      )
      .onConflictDoNothing();
  }

  return festivalId;
}
