"use server";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists, festivalTimetableSlots } from "@/db/schema";
import { ensureArtistsAndGetIds, checkExistingLineup, findExistingFestivalByNameDate, createB2bSets, deleteB2bSets } from "./festival-helpers";
import { fetchPFEventHtml } from "@/services/partyflock/client";
import { parsePFEventPage } from "@/services/partyflock/parser";
import { flattenLineupNames, filterB2bEntries, type TimetableSlot } from "@/services/lineup-types";

/** Fetch and store imageUrl for a festival that was imported without one. */
async function backfillMissingImage(festivalId: string, partyId: string): Promise<void> {
  const [row] = await db
    .select({ imageUrl: festivals.imageUrl })
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);

  if (row?.imageUrl) return;

  const html = await fetchPFEventHtml(partyId);
  if (!html) return;

  const parsed = parsePFEventPage(html);
  if (!parsed.imageUrl) return;

  await db
    .update(festivals)
    .set({ imageUrl: parsed.imageUrl })
    .where(eq(festivals.id, festivalId));
}

/** Insert timetable slots for a festival, mapping artist names to IDs. */
async function insertTimetableSlots(
  festivalId: string,
  slots: TimetableSlot[],
  nameToId: Record<string, string>
): Promise<void> {
  const rows = slots
    .filter((slot) => nameToId[slot.artistName])
    .map((slot) => ({
      festivalId,
      artistId: nameToId[slot.artistName],
      stageName: slot.stageName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      stageOrder: slot.stageOrder,
      slotOrder: slot.slotOrder,
    }));

  if (rows.length === 0) return;

  await db
    .insert(festivalTimetableSlots)
    .values(rows)
    .onConflictDoNothing();
}

/** Fetch only the og:image URL for a Partyflock event by party ID. */
export async function fetchPFEventImageUrl(partyId: string): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;

  const html = await fetchPFEventHtml(partyId);
  if (!html) return null;

  const parsed = parsePFEventPage(html);
  return parsed.imageUrl;
}

/** Force-reimport a Partyflock event (deletes existing lineup first). */
export async function reimportPFEvent(partyId: string): Promise<string | null> {
  if (!partyId) return null;
  const festivalId = `pf-${partyId}`;

  await deleteB2bSets(festivalId);

  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));

  await db
    .delete(festivalTimetableSlots)
    .where(eq(festivalTimetableSlots.festivalId, festivalId));

  return fetchPFEvent(partyId, { force: true });
}

/** Fetch a single Partyflock event by party ID and persist to DB. */
export async function fetchPFEvent(
  partyId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;

  const festivalId = `pf-${partyId}`;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, partyId);
      return festivalId;
    }
  }

  const html = await fetchPFEventHtml(partyId);
  if (!html) return null;

  const parsed = parsePFEventPage(html);
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
    source: "partyflock" as const,
    sourceId: partyId,
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
    const allNames = flattenLineupNames(parsed.lineup);
    const nameToId = await ensureArtistsAndGetIds(allNames);
    await db
      .insert(festivalArtists)
      .values(
        allNames
          .filter((artistName) => nameToId[artistName])
          .map((artistName) => ({ festivalId, artistId: nameToId[artistName] }))
      )
      .onConflictDoNothing();

    const b2bEntries = filterB2bEntries(parsed.lineup);
    if (b2bEntries.length > 0) {
      await createB2bSets(festivalId, b2bEntries, nameToId);
    }

    if (parsed.timetable.length > 0) {
      await insertTimetableSlots(festivalId, parsed.timetable, nameToId);
    }
  }

  return festivalId;
}
