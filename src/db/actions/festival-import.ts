"use server";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists } from "@/db/schema";
import {
  requireAuth,
  enforceRateLimit,
  ensureArtistsAndGetIds,
  findExistingFestivalByNameDate,
  MAX_FESTIVAL_NAME_LENGTH,
} from "./festival-helpers";
import { RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

// ── Upsert a custom festival ──────────────────────────
export async function upsertFestival(data: {
  id: string;
  name: string;
  date: string;
  endDate?: string | null;
  venue?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  source?: string | null;
  sourceId?: string | null;
  interestedCount?: number | null;
  lineup?: string[];
}) {
  await requireAuth();
  await enforceRateLimit("import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);

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
      endDate: data.endDate ?? null,
      venue: data.venue ?? null,
      location: data.location ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      imageUrl: data.imageUrl ?? null,
      source: data.source ?? "custom",
      sourceId: data.sourceId ?? null,
      interestedCount: data.interestedCount ?? 0,
    })
    .onConflictDoUpdate({
      target: [festivals.id],
      set: {
        name: data.name,
        date: data.date,
        venue: data.venue ?? null,
        location: data.location ?? null,
        endDate: sql`COALESCE(${data.endDate ?? null}, ${festivals.endDate})`,
        latitude: sql`COALESCE(${data.latitude ?? null}, ${festivals.latitude})`,
        longitude: sql`COALESCE(${data.longitude ?? null}, ${festivals.longitude})`,
        imageUrl: sql`COALESCE(${data.imageUrl ?? null}, ${festivals.imageUrl})`,
        sourceId: sql`COALESCE(${data.sourceId ?? null}, ${festivals.sourceId})`,
        interestedCount: sql`COALESCE(${data.interestedCount ?? null}, ${festivals.interestedCount})`,
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

