"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivals, festivalArtists } from "@/db/schema";
import {
  requireAuth,
  requireAdmin,
  ensureArtistsAndGetIds,
  findExistingFestivalByNameDate,
  MAX_FESTIVAL_NAME_LENGTH,
} from "./festival-helpers";

const BATCH_CHUNK_SIZE = 50;

// ── Upsert a custom festival ──────────────────────────
export async function upsertFestival(data: {
  id: string;
  name: string;
  date: string;
  venue?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  source?: string | null;
  lineup?: string[];
}) {
  await requireAuth();

  if (!data.id || !data.name || data.name.length > MAX_FESTIVAL_NAME_LENGTH) {
    throw new Error("Invalid festival data");
  }

  const existingId = await findExistingFestivalByNameDate(data.name, data.date);
  if (existingId && existingId !== data.id) {
    throw new Error("A festival with this name and date already exists");
  }

  await db
    .insert(festivals)
    .values({
      id: data.id,
      name: data.name,
      date: data.date,
      venue: data.venue ?? null,
      location: data.location ?? null,
      imageUrl: data.imageUrl ?? null,
      source: data.source ?? "custom",
    })
    .onConflictDoUpdate({
      target: [festivals.id],
      set: {
        name: data.name,
        date: data.date,
        venue: data.venue ?? null,
        location: data.location ?? null,
        imageUrl: data.imageUrl ?? null,
      },
    });

  if (data.lineup !== undefined) {
    await db
      .delete(festivalArtists)
      .where(eq(festivalArtists.festivalId, data.id));

    if (data.lineup.length > 0) {
      const nameToId = await ensureArtistsAndGetIds(data.lineup);

      await db
        .insert(festivalArtists)
        .values(
          data.lineup
            .filter((name) => nameToId[name])
            .map((name) => ({
              festivalId: data.id,
              artistId: nameToId[name],
            }))
        )
        .onConflictDoNothing();
    }
  }
}

// ── Batch import events into festivals table ───────────
export async function batchImportFestivals(
  events: Array<{
    id: string;
    name: string;
    date: string;
    venue?: string | null;
    location?: string | null;
    source?: string;
    lineup?: string[];
  }>
) {
  await requireAdmin();

  for (let i = 0; i < events.length; i += BATCH_CHUNK_SIZE) {
    const chunk = events.slice(i, i + BATCH_CHUNK_SIZE);

    const nonDuplicateEvents = [];
    for (const event of chunk) {
      const existingId = await findExistingFestivalByNameDate(event.name, event.date);
      if (!existingId || existingId === event.id) {
        nonDuplicateEvents.push(event);
      }
    }

    if (nonDuplicateEvents.length === 0) continue;

    await db
      .insert(festivals)
      .values(
        nonDuplicateEvents.map((e) => ({
          id: e.id,
          name: e.name,
          date: e.date,
          venue: e.venue ?? null,
          location: e.location ?? null,
          source: e.source ?? "ra",
        }))
      )
      .onConflictDoNothing();

    const allArtistNames = [...new Set(nonDuplicateEvents.flatMap((e) => e.lineup ?? []))];
    if (allArtistNames.length > 0) {
      const nameToId = await ensureArtistsAndGetIds(allArtistNames);

      const lineupRows = nonDuplicateEvents.flatMap((e) =>
        (e.lineup ?? [])
          .filter((name) => nameToId[name])
          .map((name) => ({
            festivalId: e.id,
            artistId: nameToId[name],
          }))
      );

      if (lineupRows.length > 0) {
        await db
          .insert(festivalArtists)
          .values(lineupRows)
          .onConflictDoNothing();
      }
    }
  }
}
