"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivals, festivalArtists } from "@/db/schema";
import { ensureArtistsAndGetIds, checkExistingLineup, findExistingFestivalByNameDate } from "./festival-helpers";
import { fetchRAEventRaw } from "@/services/ra/client";
import { parseRALineup } from "@/services/ra/parser";

/** Fetch and store imageUrl for an RA event that was imported without one. */
async function backfillMissingImage(festivalId: string, raId: string): Promise<void> {
  const [row] = await db
    .select({ imageUrl: festivals.imageUrl })
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);

  if (row?.imageUrl) return;

  const imageUrl = await fetchRAEventImageUrl(raId);
  if (!imageUrl) return;

  await db
    .update(festivals)
    .set({ imageUrl })
    .where(eq(festivals.id, festivalId));
}

/** Fetch only the image URL for an RA event by numeric ID. */
export async function fetchRAEventImageUrl(raId: string): Promise<string | null> {
  const id = String(raId).replace(/\D/g, "");
  if (!id) return null;

  const data = await fetchRAEventRaw(id);
  if (!data) return null;

  return data.images?.[0]?.filename ?? null;
}

/** Force-reimport an RA event (deletes existing lineup first) */
export async function reimportRAEvent(eventId: string): Promise<string | null> {
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;
  const festivalId = `ra-${id}`;

  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));

  return fetchRAEvent(eventId, { force: true });
}

/** Fetch a single RA event by ID from ra.co and persist to DB */
export async function fetchRAEvent(
  eventId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;

  const festivalId = `ra-${id}`;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, id);
      return festivalId;
    }
  }

  const data = await fetchRAEventRaw(id);
  if (!data) return null;

  const date = data.startTime
    ? new Date(data.startTime).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const endDate = data.endTime
    ? new Date(data.endTime).toISOString().slice(0, 10)
    : null;

  const venueName = data.venue?.name ?? null;
  const areaName = data.venue?.area?.name ?? null;
  const countryName = data.venue?.area?.country?.name ?? null;
  const location = [areaName, countryName].filter(Boolean).join(", ") || null;
  const imageUrl = data.images?.[0]?.filename ?? null;

  const artistsFallback = (data.artists ?? [])
    .map((a) => a?.name)
    .filter(Boolean) as string[];
  const lineup = parseRALineup(data.lineup, artistsFallback);

  const festivalName = data.title ?? `RA Event ${id}`;
  const existingId = await findExistingFestivalByNameDate(festivalName, date);
  if (existingId && existingId !== festivalId) {
    return existingId;
  }

  await db
    .insert(festivals)
    .values({
      id: festivalId,
      name: festivalName,
      date,
      endDate,
      venue: venueName,
      location,
      source: "ra",
      sourceId: id,
      imageUrl,
      interestedCount: (data.interestedCount ?? 0) + (data.attending ?? 0),
    })
    .onConflictDoNothing();

  if (lineup.length > 0) {
    const nameToId = await ensureArtistsAndGetIds(lineup);
    await db
      .insert(festivalArtists)
      .values(
        lineup
          .filter((name) => nameToId[name])
          .map((name) => ({ festivalId, artistId: nameToId[name] }))
      )
      .onConflictDoNothing();
  }

  return festivalId;
}
