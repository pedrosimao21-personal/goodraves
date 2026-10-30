"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import {
  festivals,
  festivalArtists,
  artists,
} from "@/db/schema";
import { requireAuth } from "./festival-helpers";
// Core (unrated) versions, not the "use server" actions in festival-import-{ra,ff,pf}.ts:
// getFestival can run in the same server-rendered request as festival-timetable.ts's
// unstable_cache call, and the actions' enforceRateLimit reads headers() — which Next.js
// disallows anywhere in a request that also uses unstable_cache. See
// festival-import-ra-core.ts's file comment for the full reasoning; this internal path is
// already throttled per-festival by lineupCheckedAt/imageCheckedAt, so it doesn't need
// the actions' per-caller rate limiting anyway.
import { fetchRAEventCore as fetchRAEvent, fetchRAEventImageUrlCore as fetchRAEventImageUrl } from "./festival-import-ra-core";
import { fetchFFEventCore as fetchFFEvent, fetchFFEventImageUrlCore as fetchFFEventImageUrl } from "./festival-import-ff-core";
import { importPFEvent as fetchPFEvent, fetchPFEventImageUrlCore as fetchPFEventImageUrl } from "./festival-import-pf-core";
import { resolvePFEventSlug } from "@/services/partyflock/client";
import { ensureRaSchedule } from "./festival-ra-schedule-core";
import { fetchUserDataForId } from "./user-data-query";
import { fetchFestivalGenres } from "./festival-genres";
import {
  LINEUP_RECHECK_STALE_MS,
  IMAGE_RECHECK_STALE_MS,
} from "@/lib/constants";

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
  lineup: { artistId: string; artistName: string }[],
  genres: string[]
) {
  return {
    ...festival,
    lineup: lineup.map((r) => ({ id: r.artistId, name: r.artistName })),
    genres,
  };
}

type FestivalSourceRef = { provider: "ff" | "ra" | "pf"; sourceId: string };

/** Parse the origin provider and its own event id out of a festival ID. */
function parseFestivalSourceRef(id: string): FestivalSourceRef | null {
  const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
  if (ffMatch) return { provider: "ff", sourceId: ffMatch[1] };

  const raMatch = id.match(/^ra-(\d+)$/);
  if (raMatch) return { provider: "ra", sourceId: raMatch[1] };

  const pfMatch = id.match(/^pf-(\d+)$/);
  if (pfMatch) return { provider: "pf", sourceId: pfMatch[1] };

  return null;
}

/** Re-import a full event (lineup, image, coordinates) from its origin source. */
function reimportFromSource(ref: FestivalSourceRef): Promise<string | null> {
  if (ref.provider === "ff") return fetchFFEvent(ref.sourceId);
  if (ref.provider === "ra") return fetchRAEvent(ref.sourceId);
  return fetchPFEvent(ref.sourceId);
}

/** Fetch only the event image from its origin source. */
function fetchImageFromSource(ref: FestivalSourceRef): Promise<string | null> {
  if (ref.provider === "ff") return fetchFFEventImageUrl(ref.sourceId);
  if (ref.provider === "ra") return fetchRAEventImageUrl(ref.sourceId);
  return fetchPFEventImageUrl(ref.sourceId);
}

/**
 * True when a backfill has never been attempted, or the last attempt is older
 * than its re-check window. A missing lineup/image on its own is not enough:
 * the source may simply have nothing yet, and retrying on every view means
 * re-scraping the origin forever.
 */
function isRecheckDue(checkedAt: Date | null, staleMs: number): boolean {
  if (!checkedAt) return true;
  return Date.now() - checkedAt.getTime() > staleMs;
}

/**
 * Re-import the lineup from the origin source, then stamp `lineupCheckedAt` and
 * return the updated row in one round trip. The returned row also carries any
 * imageUrl / lat / lng the re-import wrote via COALESCE on conflict.
 */
async function reimportLineupAndStamp(id: string, ref: FestivalSourceRef) {
  await reimportFromSource(ref);

  const [refreshed] = await db
    .update(festivals)
    .set({ lineupCheckedAt: new Date() })
    .where(eq(festivals.id, id))
    .returning();

  const [lineup, genres] = await Promise.all([
    fetchLineup(id),
    fetchFestivalGenres(id),
  ]);

  return { refreshed, lineup, genres };
}

/**
 * Backfill a missing image from the origin source. `imageCheckedAt` is stamped
 * whether or not an image came back, so a source with no image isn't re-scraped
 * on the next view.
 */
async function backfillImageAndStamp(id: string, ref: FestivalSourceRef) {
  const imageUrl = await fetchImageFromSource(ref);

  await db
    .update(festivals)
    .set(imageUrl ? { imageUrl, imageCheckedAt: new Date() } : { imageCheckedAt: new Date() })
    .where(eq(festivals.id, id));

  return imageUrl;
}

export async function getFestival(id: string) {
  // Fetch festival and lineup in parallel since they are independent
  const [festivalRows, lineup, genres] = await Promise.all([
    db.select().from(festivals).where(eq(festivals.id, id)).limit(1),
    fetchLineup(id),
    fetchFestivalGenres(id),
  ]);

  let [festival] = festivalRows;

  if (!festival) {
    return await tryAutoImport(id);
  }

  let currentLineup = lineup;
  let currentGenres = genres;
  const sourceRef = parseFestivalSourceRef(id);

  // A festival with no lineup gets re-fetched from its original source, but only
  // once per re-check window — an unannounced lineup is the normal case and used
  // to trigger a full external import on every single page view.
  const shouldRefetchLineup =
    currentLineup.length === 0 &&
    isRecheckDue(festival.lineupCheckedAt, LINEUP_RECHECK_STALE_MS);

  if (sourceRef && shouldRefetchLineup) {
    const result = await reimportLineupAndStamp(id, sourceRef);
    if (result.refreshed) festival = result.refreshed;
    currentLineup = result.lineup;
    currentGenres = result.genres;
  }

  // Backfill a missing image from the original source, same re-check guard.
  const shouldBackfillImage =
    !festival.imageUrl &&
    isRecheckDue(festival.imageCheckedAt, IMAGE_RECHECK_STALE_MS);

  if (sourceRef && shouldBackfillImage) {
    const imageUrl = await backfillImageAndStamp(id, sourceRef);
    if (imageUrl) festival.imageUrl = imageUrl;
  }

  // An RA festival saved without its clock times (added from a search card) gets
  // them, and its days re-checked, once; later views skip this.
  const withSchedule = await ensureRaSchedule(festival);
  if (withSchedule) festival = withSchedule;

  return formatFestivalWithLineup(festival, currentLineup, currentGenres);
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

/** Auto-import from RA, FestivalFans or Partyflock if the ID matches their patterns */
async function tryAutoImport(id: string) {
  const sourceRef = parseFestivalSourceRef(id);
  if (sourceRef) {
    return await importAndReturn(id, () => reimportFromSource(sourceRef));
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

  const [lineup, genres] = await Promise.all([
    fetchLineup(festivalId),
    fetchFestivalGenres(festivalId),
  ]);
  return formatFestivalWithLineup(importedFestival, lineup, genres);
}

// ── Get all user data (full state load) ────────────────
export async function getFullUserData() {
  const userId = await requireAuth();
  return fetchUserDataForId(userId);
}

// Note: the timetable read lives in festival-timetable.ts — it grew a day
// dimension (see TimetableData) and is a separate responsibility from the
// festival/lineup reads here.
