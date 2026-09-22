/**
 * Re-verifies every artist's stored Spotify match and fixes wrong ones.
 *
 * services/spotify/client.ts's spotifySearchArtist used to accept Spotify's
 * top search result unconditionally — a genre-based disambiguation check
 * existed but silently never ran, since Spotify's search endpoint no longer
 * returns `genres` on results. That let an unrelated, more-popular artist get
 * matched instead of the real one (confirmed live: "Maddix" resolved to
 * "Maddox Batson", a country singer; a sample of already-linked artists came
 * back ~22% wrong — "Storm" -> Stormzy, "ROD" -> Roddy Ricch, etc). client.ts
 * now requires an exact normalized name match; this backfills every artist
 * that was linked under the old, looser logic.
 *
 * For each artist with a stored spotifyId: re-fetches that id and compares
 * its name to ours. A mismatch (or a dead id) re-searches by name through the
 * now-fixed matcher, and either corrects the link or clears it — no image is
 * better than the wrong artist's image. `spotifyFetchedAt` is cleared
 * (instead of stamped fresh) on any change, so the artist's OTHER
 * Spotify-derived fields (albums, top tracks) — which the DB update below
 * doesn't touch, since re-deriving them here would duplicate getArtistData's
 * existing refresh logic — pick up correctly on that artist's next page view
 * instead of staying wrong for up to another SPOTIFY_STALE_MS.
 *
 * SAFETY: a "no match" here means data loss (the stored link gets cleared),
 * so this must never confuse "the API call itself failed" (missing keys, a
 * network blip, exhausted retries — a reason to STOP, not a verdict) with
 * "Spotify genuinely has no exact match" (a reason to clear). An earlier
 * version of this script did exactly that: catch(() => null) around every
 * call meant a single misconfigured env file made every lookup throw
 * NO_SPOTIFY_KEYS, which read as "no match" for 117 real artists in a row
 * before anyone noticed. This version aborts immediately on NO_SPOTIFY_KEYS
 * specifically; any other failed lookup skips that row untouched (only a
 * 404/400 on the stored id counts as "dead id"); and it aborts if too many
 * consecutive rows fail outright
 * (MAX_CONSECUTIVE_FAILURES) — real per-artist "no exact match" cases don't
 * cluster like that among artists that were already matched once before.
 *
 * It also aborts on SPOTIFY_RATE_LIMITED (Spotify asking us to back off for
 * longer than client.ts will wait — hours, once the app's quota is spent).
 * Rows are processed in id order and every abort prints the last fully
 * processed id, so a run can be resumed in batches with --start-after/--limit.
 *
 * Usage: npx tsx --env-file=.env --env-file=.env.local scripts/refresh-spotify-matches.ts
 *          [--dry-run] [--start-after <artistId>] [--limit <n>]
 */
export {};

const DRY_RUN = process.argv.includes("--dry-run");
const START_AFTER = readArg("--start-after");
const LIMIT = Number(readArg("--limit") ?? Infinity);

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
// Sequential, not parallel — services/spotify/client.ts's own comments note
// concurrent /search calls get 429-blocked; this paces both the per-id GET
// and the per-name re-search at the same rate artist-images.ts already
// trusts for sequential Spotify search calls.
const REQUEST_DELAY_MS = 500;
// Abort if this many rows in a row have a lookup fail outright (each one is
// already skipped untouched) — that pattern means something is systemically
// broken (keys, network, exhausted retries), not a per-artist problem.
const MAX_CONSECUTIVE_FAILURES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Same loose cross-system comparison as spotifySearchArtist's own check. */
function normalizeForMatch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Distinguishes "the call itself failed" from a legitimate null result.
 * Plain fields rather than a discriminated union: TS's narrowing through a
 * generic function's return type isn't reliable enough here to be worth it.
 */
class CallOutcome<T> {
  constructor(
    readonly failed: boolean,
    readonly value: T | null,
    readonly error: unknown
  ) {}
}

async function tryCall<T>(fn: () => Promise<T>): Promise<CallOutcome<T>> {
  try {
    return new CallOutcome<T>(false, await fn(), null);
  } catch (error) {
    return new CallOutcome<T>(true, null, error);
  }
}

// Errors that mean every further call will fail the same way — stop, don't
// keep going and don't treat them as a per-artist verdict.
const FATAL_ERRORS = new Set(["NO_SPOTIFY_KEYS", "SPOTIFY_RATE_LIMITED"]);

function isFatalError(outcome: CallOutcome<unknown>): boolean {
  return outcome.failed && outcome.error instanceof Error && FATAL_ERRORS.has(outcome.error.message);
}

function fatalAbort(outcome: CallOutcome<unknown>, lastDoneId: string | null): Error {
  return new Error(
    `Aborting: ${(outcome.error as Error).message} — nothing was cleared by this call. ` +
    `Resume with --start-after ${lastDoneId ?? "<none — start from the beginning>"}.`
  );
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /Spotify error (400|404)\b/.test(error.message);
}

/**
 * A row whose check itself failed is skipped untouched. Too many in a row
 * means something systemic (network, auth, exhausted retries) — abort.
 */
function recordFailure(
  consecutiveFailures: number,
  row: { id: string; name: string },
  error: unknown,
  lastDoneId: string | null
): number {
  const count = consecutiveFailures + 1;
  console.log(`SKIP:  "${row.name}" — lookup failed (${String(error)}), left untouched`);
  if (count >= MAX_CONSECUTIVE_FAILURES) {
    throw new Error(
      `Aborting: ${count} consecutive lookups failed outright — this looks systemic, not per-artist. ` +
      `Nothing from this streak was changed. Resume with --start-after ${lastDoneId ?? "<none>"}.`
    );
  }
  return count;
}

async function main() {
  const { db } = await import("../src/db/index.js");
  const { artists } = await import("../src/db/schema.js");
  const { isNotNull, eq, gt, and, asc } = await import("drizzle-orm");
  const { spotifyGetArtist, spotifySearchArtist } = await import("../src/services/spotify/client.js");

  const rows = await db
    .select({ id: artists.id, name: artists.name, spotifyId: artists.spotifyId })
    .from(artists)
    .where(START_AFTER
      ? and(isNotNull(artists.spotifyId), gt(artists.id, START_AFTER))
      : isNotNull(artists.spotifyId))
    .orderBy(asc(artists.id))
    .limit(Number.isFinite(LIMIT) ? LIMIT : 1_000_000);

  const prefix = DRY_RUN ? "[DRY RUN] " : "";
  console.log(`${prefix}Checking ${rows.length} artists with a stored Spotify match...`);

  let checked = 0;
  let mismatched = 0;
  let refixed = 0;
  let clearedNoMatch = 0;
  let consecutiveFailures = 0;
  let lastDoneId: string | null = START_AFTER ?? null;

  for (const row of rows) {
    if (checked > 0) lastDoneId = rows[checked - 1].id;
    checked++;

    const getOutcome = await tryCall(() => spotifyGetArtist(row.spotifyId!));
    if (isFatalError(getOutcome)) throw fatalAbort(getOutcome, lastDoneId);
    await sleep(REQUEST_DELAY_MS);

    // Only a 404/400 from Spotify means "this id is dead". Any other failure
    // means we couldn't check — leave the row exactly as it is.
    const isDeadId = getOutcome.failed && isNotFoundError(getOutcome.error);
    if (getOutcome.failed && !isDeadId) {
      consecutiveFailures = recordFailure(consecutiveFailures, row, getOutcome.error, lastDoneId);
      continue;
    }

    const current = getOutcome.value;
    if (current && normalizeForMatch(current.name) === normalizeForMatch(row.name)) {
      consecutiveFailures = 0;
      continue; // already correct
    }

    const searchOutcome = await tryCall(() => spotifySearchArtist(row.name));
    if (isFatalError(searchOutcome)) throw fatalAbort(searchOutcome, lastDoneId);
    await sleep(REQUEST_DELAY_MS);
    if (searchOutcome.failed) {
      consecutiveFailures = recordFailure(consecutiveFailures, row, searchOutcome.error, lastDoneId);
      continue;
    }
    consecutiveFailures = 0;
    mismatched++;

    const rematch = searchOutcome.value;
    const wrongDesc = current
      ? `"${row.name}" was linked to "${current.name}"`
      : `"${row.name}"'s stored Spotify id no longer resolves`;

    if (rematch) {
      console.log(`${prefix}FIX:   ${wrongDesc} -> re-matched to "${rematch.name}" (spotify:${rematch.id})`);
      refixed++;
      if (!DRY_RUN) {
        await db
          .update(artists)
          .set({
            spotifyId: rematch.id,
            imageUrl: rematch.image,
            spotifyFollowers: rematch.followers,
            spotifyFetchedAt: null,
          })
          .where(eq(artists.id, row.id));
      }
    } else {
      console.log(`${prefix}CLEAR: ${wrongDesc} -> no exact match found, clearing the Spotify link`);
      clearedNoMatch++;
      if (!DRY_RUN) {
        await db
          .update(artists)
          .set({
            spotifyId: null,
            imageUrl: null,
            spotifyFollowers: null,
            spotifyFetchedAt: null,
          })
          .where(eq(artists.id, row.id));
      }
    }

    if (checked % 100 === 0) {
      console.log(`${prefix}... ${checked}/${rows.length} checked, ${mismatched} mismatched so far (last id ${row.id})`);
    }
  }

  console.log(
    `\n${prefix}Done. checked=${checked} mismatched=${mismatched} refixed=${refixed} clearedNoMatch=${clearedNoMatch}` +
    ` lastId=${rows[rows.length - 1]?.id ?? lastDoneId}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
