import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { artists } from "@/db/schema";
import { foldArtistName } from "@/lib/lineup-name";
import { toIsoDate } from "@/lib/dates";
import { sleep } from "@/lib/retry";
import { spotifyGetArtist, spotifySearchArtist } from "@/services/spotify/client";
import { SPOTIFY_VERIFY_REQUEST_DELAY_MS, SPOTIFY_VERIFY_MAX_CONSECUTIVE_FAILURES } from "@/lib/constants";

/**
 * Keeps stored Spotify matches honest. Matching used to accept Spotify's top
 * search result, so some artists are linked to somebody else ("Franck" ->
 * Frank Ocean): wrong photo, albums, top tracks and related artists. Each link
 * is re-fetched and its name compared with ours; a mismatch is re-searched
 * through the exact-name matcher and either corrected or cleared — no link is
 * better than the wrong artist's.
 *
 * SAFETY: "no match" means data loss (the link is cleared), so this must never
 * confuse "the API call failed" (keys missing, network, quota — a reason to
 * STOP) with "Spotify genuinely has no exact match" (a reason to clear). Fatal
 * errors abort the whole run, a failed lookup leaves that artist untouched, and
 * a streak of failures aborts. Only a 404/400 on the stored id counts as a dead id.
 */

const FATAL_ERRORS = new Set(["NO_SPOTIFY_KEYS", "SPOTIFY_RATE_LIMITED"]);

type LinkRow = { id: string; name: string; spotifyId: string; imageSource: string | null; imageLocked: boolean };

export type SpotifyVerifySummary = {
  checked: number;
  alreadyCorrect: number;
  rematched: number;
  cleared: number;
  skipped: number;
  /** Set when the run stopped early (quota, keys, or a streak of failures), with the reason. */
  abortedBecause: string | null;
};

/** A call that failed, as opposed to one that legitimately returned null. */
class Failed {
  constructor(readonly error: unknown) {}
}

async function attempt<T>(fn: () => Promise<T>): Promise<T | Failed> {
  try {
    return await fn();
  } catch (error) {
    return new Failed(error);
  }
}

function isFatal(result: unknown): result is Failed {
  return result instanceof Failed && result.error instanceof Error && FATAL_ERRORS.has(result.error.message);
}

/** Spotify answered 400/404: the id itself is dead (as opposed to the call failing). */
function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /Spotify error (400|404)\b/.test(error.message);
}

function isDeadId(result: unknown): boolean {
  return result instanceof Failed && isNotFoundError(result.error);
}

/**
 * The Spotify artist to use for `name`: the stored link while it still points at
 * an artist with our name, otherwise a fresh exact-name search. `hadWrongLink`
 * is true when a stored link pointed at somebody else (or at nothing).
 */
export async function resolveSpotifyArtist(name: string, existingId: string | null) {
  if (!existingId) return { artist: await spotifySearchArtist(name), hadWrongLink: false };
  // Only a dead id counts as "no artist"; any other failure (network, quota) is
  // rethrown so a bad moment never reads as a wrong link.
  const current = await spotifyGetArtist(existingId).catch((error) => {
    if (isNotFoundError(error)) return null;
    throw error;
  });
  if (current && foldArtistName(current.name) === foldArtistName(name)) return { artist: current, hadWrongLink: false };
  return { artist: await spotifySearchArtist(name), hadWrongLink: true };
}

/** Whether a Spotify lookup may replace this artist's photo (an RA or admin photo is never replaced). */
function canReplacePhoto(row: Pick<LinkRow, "imageSource" | "imageLocked">): boolean {
  return !row.imageLocked && row.imageSource !== "ra";
}

/** Everything derived from the old (wrong) link is dropped, so the next view re-derives it from the right artist. */
const DERIVED_FROM_OLD_LINK = {
  spotifyAlbums: null,
  relatedArtists: null,
  relatedArtistsFetchedAt: null,
  lastfmTopTracks: null,
  lastfmFetchedAt: null,
  spotifyFetchedAt: null,
} as const;

async function saveCorrection(row: LinkRow, rematch: { id: string; image: string | null; followers: number } | null): Promise<void> {
  const link = rematch
    ? { spotifyId: rematch.id, spotifyFollowers: rematch.followers }
    : { spotifyId: null, spotifyFollowers: null };
  const photo = canReplacePhoto(row)
    ? { imageUrl: rematch?.image ?? null, imageSource: rematch?.image ? "spotify" : null }
    : {};
  await db
    .update(artists)
    .set({ ...link, ...photo, ...DERIVED_FROM_OLD_LINK, spotifyVerifiedAt: new Date() })
    .where(eq(artists.id, row.id));
}

async function selectLinksToVerify(limit: number): Promise<LinkRow[]> {
  const today = toIsoDate(new Date());
  const result = await db.execute(sql`
    SELECT a.id, a.name, a.spotify_id AS "spotifyId", a.image_source AS "imageSource", a.image_locked AS "imageLocked"
    FROM artists a
    WHERE a.spotify_id IS NOT NULL AND a.spotify_verified_at IS NULL
    ORDER BY
      EXISTS (SELECT 1 FROM festival_artists fa JOIN festivals f ON f.id = fa.festival_id
              WHERE fa.artist_id = a.id AND coalesce(f.end_date, f.date) >= ${today}) DESC,
      a.id
    LIMIT ${limit}`);
  return result.rows as LinkRow[];
}

/** Verifies the next `limit` unverified links (lineups still to come first), spending at most two Spotify calls each. */
export async function verifySpotifyLinks(opts: {
  limit: number;
  isDryRun?: boolean;
  /** Stop starting new checks after this many ms (the daily job's time budget). */
  deadlineMs?: number;
  log?: (line: string) => void;
}): Promise<SpotifyVerifySummary> {
  const startedAt = Date.now();
  const log = opts.log ?? (() => undefined);
  const prefix = opts.isDryRun ? "[DRY RUN] " : "";
  const summary: SpotifyVerifySummary = { checked: 0, alreadyCorrect: 0, rematched: 0, cleared: 0, skipped: 0, abortedBecause: null };
  let consecutiveFailures = 0;

  for (const row of await selectLinksToVerify(opts.limit)) {
    if (opts.deadlineMs !== undefined && Date.now() - startedAt > opts.deadlineMs) break;
    const current = await attempt(() => spotifyGetArtist(row.spotifyId));
    if (isFatal(current)) { summary.abortedBecause = (current.error as Error).message; break; }
    await sleep(SPOTIFY_VERIFY_REQUEST_DELAY_MS);

    // Only a 404/400 means "this id is dead"; any other failure means we could not check.
    if (current instanceof Failed && !isDeadId(current)) {
      summary.skipped += 1;
      log(`SKIP:  "${row.name}" — lookup failed (${String(current.error)}), left untouched`);
      if (++consecutiveFailures >= SPOTIFY_VERIFY_MAX_CONSECUTIVE_FAILURES) { summary.abortedBecause = "too many failed lookups in a row"; break; }
      continue;
    }
    consecutiveFailures = 0;
    summary.checked += 1;

    const linked = current instanceof Failed ? null : current;
    if (linked && foldArtistName(linked.name) === foldArtistName(row.name)) {
      summary.alreadyCorrect += 1;
      if (!opts.isDryRun) await db.update(artists).set({ spotifyVerifiedAt: new Date() }).where(eq(artists.id, row.id));
      continue;
    }

    const search = await attempt(() => spotifySearchArtist(row.name));
    if (isFatal(search)) { summary.abortedBecause = (search.error as Error).message; break; }
    await sleep(SPOTIFY_VERIFY_REQUEST_DELAY_MS);
    if (search instanceof Failed) {
      summary.skipped += 1;
      log(`SKIP:  "${row.name}" — re-search failed (${String(search.error)}), left untouched`);
      continue;
    }

    const wrong = linked ? `"${row.name}" was linked to "${linked.name}"` : `"${row.name}"'s stored Spotify id no longer resolves`;
    if (search) {
      summary.rematched += 1;
      log(`${prefix}FIX:   ${wrong} -> re-matched to "${search.name}" (spotify:${search.id})`);
    } else {
      summary.cleared += 1;
      log(`${prefix}CLEAR: ${wrong} -> no exact match, clearing the Spotify link`);
    }
    if (!opts.isDryRun) await saveCorrection(row, search);
  }
  return summary;
}
