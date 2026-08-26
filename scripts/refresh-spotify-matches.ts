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
 * Usage: npx tsx --env-file=.env.local scripts/refresh-spotify-matches.ts [--dry-run]
 */
export {};

const DRY_RUN = process.argv.includes("--dry-run");
// Sequential, not parallel — services/spotify/client.ts's own comments note
// concurrent /search calls get 429-blocked; this paces both the per-id GET
// and the per-name re-search at the same rate artist-images.ts already
// trusts for sequential Spotify search calls.
const REQUEST_DELAY_MS = 500;

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

async function main() {
  const { db } = await import("../src/db/index.js");
  const { artists } = await import("../src/db/schema.js");
  const { isNotNull, eq } = await import("drizzle-orm");
  const { spotifyGetArtist, spotifySearchArtist } = await import("../src/services/spotify/client.js");

  const rows = await db
    .select({ id: artists.id, name: artists.name, spotifyId: artists.spotifyId })
    .from(artists)
    .where(isNotNull(artists.spotifyId));

  const prefix = DRY_RUN ? "[DRY RUN] " : "";
  console.log(`${prefix}Checking ${rows.length} artists with a stored Spotify match...`);

  let checked = 0;
  let mismatched = 0;
  let refixed = 0;
  let clearedNoMatch = 0;

  for (const row of rows) {
    checked++;

    let current: Awaited<ReturnType<typeof spotifyGetArtist>> | null = null;
    try {
      current = await spotifyGetArtist(row.spotifyId!);
    } catch {
      current = null;
    }
    await sleep(REQUEST_DELAY_MS);

    if (current && normalizeForMatch(current.name) === normalizeForMatch(row.name)) {
      continue; // already correct
    }
    mismatched++;

    const wrongDesc = current
      ? `"${row.name}" was linked to "${current.name}"`
      : `"${row.name}"'s stored Spotify id no longer resolves`;

    const rematch = await spotifySearchArtist(row.name).catch(() => null);
    await sleep(REQUEST_DELAY_MS);

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
      console.log(`${prefix}... ${checked}/${rows.length} checked, ${mismatched} mismatched so far`);
    }
  }

  console.log(
    `\n${prefix}Done. checked=${checked} mismatched=${mismatched} refixed=${refixed} clearedNoMatch=${clearedNoMatch}`
  );
}

main().catch(console.error).finally(() => process.exit(0));
