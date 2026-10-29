import { db } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { artists } from "@/db/schema";
import { foldArtistName } from "@/lib/lineup-name";
import { toIsoDate } from "@/lib/dates";
import { sleep } from "@/lib/retry";
import {
  lookupRAArtistById,
  lookupRAArtistBySlug,
  raSlugFor,
  type RAArtistProfile,
} from "@/services/ra/artist-profile";
import {
  RA_PHOTO_RECHECK_DAYS,
  RA_PHOTO_REQUEST_DELAY_MS,
  RA_PHOTO_ON_DEMAND_CONCURRENCY,
  RA_PHOTO_MAX_CONSECUTIVE_ERRORS,
} from "@/lib/constants";

/**
 * Artist photos, Resident Advisor first. RA's curated DJ profile photo beats a
 * Spotify name search: Spotify is a music catalogue (many underground DJs are
 * missing or share a name with a famous musician), while RA's artist ids come
 * straight from real event lineups. Order of preference: an admin's manual
 * photo (locked, never replaced) > RA > Spotify > nothing. RA is only trusted
 * when the profile's name matches ours.
 */

export type PhotoArtist = {
  id: string;
  name: string;
  raArtistId: string | null;
  imageUrl: string | null;
  imageSource: string | null;
  imageLocked: boolean;
};

export type PhotoOutcome =
  /** RA photo applied; `replaced` = it took the place of an existing (Spotify) photo. */
  | { status: "photo"; imageUrl: string; replaced: boolean; raArtistId: string }
  /** On RA, name matches, but RA has no photo for them. */
  | { status: "ra-no-photo"; raArtistId: string }
  | { status: "not-on-ra" }
  /** RA has an artist at that slug/id, but under a different name: not used. */
  | { status: "name-mismatch"; raName: string | null }
  | { status: "locked" }
  /** The RA request failed: nothing is recorded, so it is retried later. */
  | { status: "error"; error: unknown };

function isSameName(ours: string, theirs: string | null): boolean {
  return theirs !== null && foldArtistName(ours) === foldArtistName(theirs);
}

async function lookupProfile(artist: PhotoArtist) {
  return artist.raArtistId ? lookupRAArtistById(artist.raArtistId) : lookupRAArtistBySlug(raSlugFor(artist.name));
}

function describeLookup(artist: PhotoArtist, profile: RAArtistProfile): PhotoOutcome {
  if (!isSameName(artist.name, profile.name)) return { status: "name-mismatch", raName: profile.name };
  if (!profile.imageUrl) return { status: "ra-no-photo", raArtistId: profile.raArtistId };
  return {
    status: "photo",
    imageUrl: profile.imageUrl,
    replaced: artist.imageUrl !== null && artist.imageUrl !== profile.imageUrl,
    raArtistId: profile.raArtistId,
  };
}

/** What RA says about this artist, without touching the database. */
export async function previewRaPhoto(artist: PhotoArtist): Promise<PhotoOutcome> {
  if (artist.imageLocked) return { status: "locked" };
  const lookup = await lookupProfile(artist);
  if (lookup.status === "error") return { status: "error", error: lookup.error };
  if (lookup.status === "missing") return { status: "not-on-ra" };
  return describeLookup(artist, lookup.profile);
}

/** Records the outcome. `image_locked = false` in each WHERE, so an admin's fix made meanwhile always wins. */
async function persistOutcome(artist: PhotoArtist, outcome: PhotoOutcome, now: Date): Promise<void> {
  if (outcome.status === "error" || outcome.status === "locked") return;
  const notLocked = and(eq(artists.id, artist.id), eq(artists.imageLocked, false));

  if (outcome.status === "photo") {
    await db
      .update(artists)
      .set({ imageUrl: outcome.imageUrl, imageSource: "ra", raArtistId: outcome.raArtistId, raPhotoCheckedAt: now })
      .where(notLocked);
  } else if (outcome.status === "ra-no-photo") {
    await db.update(artists).set({ raArtistId: outcome.raArtistId, raPhotoCheckedAt: now }).where(notLocked);
  } else {
    await db.update(artists).set({ raPhotoCheckedAt: now }).where(notLocked);
  }
}

/** Looks the artist up on RA and, unless `isDryRun`, stores what it found. */
export async function applyRaPhoto(artist: PhotoArtist, opts: { isDryRun?: boolean } = {}): Promise<PhotoOutcome> {
  const outcome = await previewRaPhoto(artist);
  if (!opts.isDryRun) await persistOutcome(artist, outcome, new Date());
  return outcome;
}

const PHOTO_COLUMNS = sql`a.id, a.name, a.ra_artist_id AS "raArtistId", a.image_url AS "imageUrl", a.image_source AS "imageSource", a.image_locked AS "imageLocked"`;

/** An artist whose RA photo hasn't been tried within the recheck window. */
const IS_DUE = sql`NOT a.image_locked
  AND a.image_source IS DISTINCT FROM 'ra'
  AND (a.ra_photo_checked_at IS NULL OR a.ra_photo_checked_at < now() - make_interval(days => ${RA_PHOTO_RECHECK_DAYS}))`;

/**
 * The next artists to look up: those in lineups still to come first (they are
 * the ones people see), then ones whose RA id we already know (a sure hit).
 */
export async function selectPhotoCandidates(limit: number): Promise<PhotoArtist[]> {
  const today = toIsoDate(new Date());
  const result = await db.execute(sql`
    SELECT ${PHOTO_COLUMNS} FROM artists a
    WHERE ${IS_DUE} AND EXISTS (SELECT 1 FROM festival_artists fa WHERE fa.artist_id = a.id)
    ORDER BY
      EXISTS (SELECT 1 FROM festival_artists fa JOIN festivals f ON f.id = fa.festival_id
              WHERE fa.artist_id = a.id AND coalesce(f.end_date, f.date) >= ${today}) DESC,
      (a.ra_artist_id IS NOT NULL) DESC,
      a.id
    LIMIT ${limit}`);
  return result.rows as PhotoArtist[];
}

export type PhotoBackfillSummary = {
  checked: number;
  /** An RA photo was found where there was none. */
  newPhotos: number;
  /** An RA photo took the place of a Spotify one. */
  replacedPhotos: number;
  raNoPhoto: number;
  notOnRa: number;
  nameMismatches: number;
  errors: number;
  aborted: boolean;
};

function emptySummary(): PhotoBackfillSummary {
  return { checked: 0, newPhotos: 0, replacedPhotos: 0, raNoPhoto: 0, notOnRa: 0, nameMismatches: 0, errors: 0, aborted: false };
}

function tally(summary: PhotoBackfillSummary, outcome: PhotoOutcome): void {
  if (outcome.status === "photo") summary[outcome.replaced ? "replacedPhotos" : "newPhotos"] += 1;
  else if (outcome.status === "ra-no-photo") summary.raNoPhoto += 1;
  else if (outcome.status === "not-on-ra") summary.notOnRa += 1;
  else if (outcome.status === "name-mismatch") summary.nameMismatches += 1;
  else if (outcome.status === "error") summary.errors += 1;
}

function describeOutcome(artist: PhotoArtist, outcome: PhotoOutcome): string {
  switch (outcome.status) {
    case "photo": return `${outcome.replaced ? "REPLACE" : "NEW    "} "${artist.name}" -> ${outcome.imageUrl}`;
    case "name-mismatch": return `MISMATCH "${artist.name}" vs RA "${outcome.raName}" (not used)`;
    case "ra-no-photo": return `NO PHOTO ON RA "${artist.name}"`;
    case "not-on-ra": return `NOT ON RA "${artist.name}"`;
    case "error": return `ERROR "${artist.name}": ${String(outcome.error)}`;
    default: return `LOCKED "${artist.name}"`;
  }
}

/**
 * Works through the next `limit` due artists, one RA request at a time. Stops
 * early at `deadlineMs` (the daily job's time budget) or after a streak of
 * failed requests (RA down, not a per-artist problem). Idempotent: every
 * artist it settles is stamped, so the next run continues where this stopped.
 */
export async function runArtistPhotoBackfill(opts: {
  limit: number;
  isDryRun?: boolean;
  deadlineMs?: number;
  log?: (line: string) => void;
}): Promise<PhotoBackfillSummary> {
  const log = opts.log ?? (() => undefined);
  const startedAt = Date.now();
  const summary = emptySummary();
  let consecutiveErrors = 0;

  for (const artist of await selectPhotoCandidates(opts.limit)) {
    if (opts.deadlineMs !== undefined && Date.now() - startedAt > opts.deadlineMs) break;
    const outcome = await applyRaPhoto(artist, { isDryRun: opts.isDryRun });
    summary.checked += 1;
    tally(summary, outcome);
    log(describeOutcome(artist, outcome));

    consecutiveErrors = outcome.status === "error" ? consecutiveErrors + 1 : 0;
    if (consecutiveErrors >= RA_PHOTO_MAX_CONSECUTIVE_ERRORS) {
      summary.aborted = true;
      break;
    }
    await sleep(RA_PHOTO_REQUEST_DELAY_MS);
  }
  return summary;
}

/**
 * On-demand pass for a lineup being viewed: tries RA for the named artists that
 * are due, a few at a time, and returns lower-cased name -> new RA photo URL.
 * Each artist is looked up at most once per recheck window, so a lineup costs
 * RA requests on its first views only.
 */
export async function ensureRaPhotos(names: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (names.length === 0) return found;

  const due = (await db.execute(sql`
    SELECT ${PHOTO_COLUMNS} FROM artists a
    WHERE ${IS_DUE} AND lower(a.name) IN (${sql.join(names.map((name) => sql`${name.toLowerCase()}`), sql`, `)})`)).rows as PhotoArtist[];

  for (let i = 0; i < due.length; i += RA_PHOTO_ON_DEMAND_CONCURRENCY) {
    const chunk = due.slice(i, i + RA_PHOTO_ON_DEMAND_CONCURRENCY);
    const outcomes = await Promise.all(chunk.map((artist) => applyRaPhoto(artist)));
    outcomes.forEach((outcome, index) => {
      if (outcome.status === "photo") found.set(chunk[index].name.toLowerCase(), outcome.imageUrl);
    });
  }
  return found;
}
