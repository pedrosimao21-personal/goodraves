"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import {
  festivals,
  festivalArtists,
  festivalTimetableSlots,
  artists,
} from "@/db/schema";
import { requireAuth } from "./festival-helpers";
import { fetchRAEvent, fetchRAEventImageUrl } from "./festival-import-ra";
import { fetchFFEvent, fetchFFEventImageUrl } from "./festival-import-ff";
import { fetchPFEvent, fetchPFEventImageUrl } from "./festival-import-pf";
import { resolvePFEventSlug } from "@/services/partyflock/client";
import { fetchUserDataForId } from "./user-data-query";

// ── Get a single festival with its lineup ──────────────

/** Query lineup for a given festival ID */
async function fetchLineup(festivalId: string) {
  return db
    .select({ artistId: festivalArtists.artistId, artistName: artists.name })
    .from(festivalArtists)
    .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
    .where(eq(festivalArtists.festivalId, festivalId));
}

/** Format lineup rows into the response shape */
function formatFestivalWithLineup(
  festival: typeof festivals.$inferSelect,
  lineup: { artistId: string; artistName: string }[]
) {
  return {
    ...festival,
    lineup: lineup.map((r) => ({ id: r.artistId, name: r.artistName })),
  };
}

export async function getFestival(id: string) {
  // Fetch festival and lineup in parallel since they are independent
  const [festivalRows, lineup] = await Promise.all([
    db.select().from(festivals).where(eq(festivals.id, id)).limit(1),
    fetchLineup(id),
  ]);

  let [festival] = festivalRows;

  if (!festival) {
    return await tryAutoImport(id);
  }

  let currentLineup = lineup;

  // If the festival has no lineup, re-fetch from the original source to populate.
  // After the re-fetch, re-read the festival row so we pick up any imageUrl or
  // coordinate updates that PF/FF imports write via COALESCE on conflict.
  if (currentLineup.length === 0) {
    const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
    const raMatch = id.match(/^ra-(\d+)$/);
    const pfMatch = id.match(/^pf-(\d+)$/);
    if (ffMatch) {
      await fetchFFEvent(ffMatch[1]);
      currentLineup = await fetchLineup(id);
    } else if (raMatch) {
      await fetchRAEvent(raMatch[1]);
      currentLineup = await fetchLineup(id);
    } else if (pfMatch) {
      await fetchPFEvent(pfMatch[1]);
      currentLineup = await fetchLineup(id);
    }

    // Re-read the festival row to capture any imageUrl / lat/lng written by the re-fetch
    const [refreshed] = await db
      .select()
      .from(festivals)
      .where(eq(festivals.id, id))
      .limit(1);
    if (refreshed) festival = refreshed;
  }

  // Backfill missing image from the original source
  if (!festival.imageUrl) {
    const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
    const raMatch = id.match(/^ra-(\d+)$/);
    const pfMatch = id.match(/^pf-(\d+)$/);
    let imageUrl: string | null = null;

    if (ffMatch) {
      imageUrl = await fetchFFEventImageUrl(ffMatch[1]);
    } else if (raMatch) {
      imageUrl = await fetchRAEventImageUrl(raMatch[1]);
    } else if (pfMatch) {
      imageUrl = await fetchPFEventImageUrl(pfMatch[1]);
    }

    if (imageUrl) {
      await db
        .update(festivals)
        .set({ imageUrl })
        .where(eq(festivals.id, id));
      festival.imageUrl = imageUrl;
    }
  }

  return formatFestivalWithLineup(festival, currentLineup);
}

/**
 * Lightweight festival read for page metadata (<title>, OpenGraph).
 * Plain DB lookup only — no lineup fetch, auto-import, or image backfill —
 * so it stays cheap and side-effect-free when Next generates metadata.
 * Returns null if the festival isn't already in the DB.
 */
export async function getFestivalMeta(id: string) {
  const [festival] = await db
    .select({
      name: festivals.name,
      venue: festivals.venue,
      date: festivals.date,
      imageUrl: festivals.imageUrl,
    })
    .from(festivals)
    .where(eq(festivals.id, id))
    .limit(1);

  return festival ?? null;
}

/** Auto-import from RA or FestivalFans if the ID matches their patterns */
async function tryAutoImport(id: string) {
  const raMatch = id.match(/^ra-(\d+)$/);
  if (raMatch) {
    return await importAndReturn(id, () => fetchRAEvent(raMatch[1]));
  }

  const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
  if (ffMatch) {
    return await importAndReturn(id, () => fetchFFEvent(ffMatch[1]));
  }

  const pfMatch = id.match(/^pf-(\d+)$/);
  if (pfMatch) {
    return await importAndReturn(id, () => fetchPFEvent(pfMatch[1]));
  }

  // Partyflock permanent series URLs (/event/slug) can't be fetched directly;
  // resolve the slug to the underlying numeric party ID first.
  const pfEventMatch = id.match(/^pf-event-([a-z0-9-]+)$/);
  if (pfEventMatch) {
    const partyId = await resolvePFEventSlug(pfEventMatch[1]);
    if (!partyId) return null;
    return await importAndReturn(`pf-${partyId}`, () => fetchPFEvent(partyId));
  }

  return null;
}

/** Import an event and return it with lineup, or null on failure */
async function importAndReturn(
  festivalId: string,
  importFn: () => Promise<string | null>
) {
  const imported = await importFn();
  if (!imported) return null;

  const [importedFestival] = await db
    .select()
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);
  if (!importedFestival) return null;

  const lineup = await fetchLineup(festivalId);
  return formatFestivalWithLineup(importedFestival, lineup);
}

// ── Get all user data (full state load) ────────────────
export async function getFullUserData() {
  const userId = await requireAuth();
  return fetchUserDataForId(userId);
}

// ── Timetable ──────────────────────────────────────────

export type TimetableStage = {
  stageName: string;
  stageOrder: number;
  slots: TimetableSlotRow[];
};

export type TimetableSlotRow = {
  artistId: string;
  artistName: string;
  startTime: string;
  endTime: string;
  slotOrder: number;
};

/**
 * Fetch all timetable slots for a festival, grouped by stage.
 * Returns an empty array when no timetable data exists.
 */
export async function getTimetable(festivalId: string): Promise<TimetableStage[]> {
  const rows = await db
    .select({
      stageName: festivalTimetableSlots.stageName,
      stageOrder: festivalTimetableSlots.stageOrder,
      slotOrder: festivalTimetableSlots.slotOrder,
      startTime: festivalTimetableSlots.startTime,
      endTime: festivalTimetableSlots.endTime,
      artistId: artists.id,
      artistName: artists.name,
    })
    .from(festivalTimetableSlots)
    .innerJoin(artists, eq(festivalTimetableSlots.artistId, artists.id))
    .where(eq(festivalTimetableSlots.festivalId, festivalId))
    .orderBy(festivalTimetableSlots.stageOrder, festivalTimetableSlots.slotOrder);

  const stageMap = new Map<number, TimetableStage>();

  for (const row of rows) {
    let stage = stageMap.get(row.stageOrder);
    if (!stage) {
      stage = { stageName: row.stageName, stageOrder: row.stageOrder, slots: [] };
      stageMap.set(row.stageOrder, stage);
    }
    stage.slots.push({
      artistId: row.artistId,
      artistName: row.artistName,
      startTime: row.startTime,
      endTime: row.endTime,
      slotOrder: row.slotOrder,
    });
  }

  return Array.from(stageMap.values()).sort((a, b) => a.stageOrder - b.stageOrder);
}
