/**
 * Re-verifies artists' stored Spotify matches and fixes wrong ones.
 *
 * Matching used to accept Spotify's top search result, so some artists are
 * linked to somebody else ("Franck" -> Frank Ocean, "Maddix" -> a country
 * singer, "Storm" -> Stormzy). For each artist with a stored Spotify id this
 * re-fetches that id and compares its name with ours; a mismatch is re-searched
 * through the exact-name matcher and either corrected or cleared, together with
 * everything derived from the wrong link (albums, top tracks, related artists).
 * RA and admin-set photos are never replaced. The logic lives in
 * src/db/actions/spotify-verify-core.ts, which the daily maintenance cron also
 * runs in small batches.
 *
 * Verified artists are stamped (artists.spotify_verified_at), so repeating the
 * command continues with the next unverified ones — upcoming lineups first.
 * It aborts (changing nothing for the call that failed) when Spotify's quota is
 * spent or the keys are missing; a "no match" is only ever a real answer.
 *
 * Usage: npx tsx --env-file=.env --env-file=.env.local scripts/refresh-spotify-matches.ts [--dry-run] [--limit <n>]
 */
export {};

const IS_DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_LIMIT = 100;

function readNumberArg(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? Number(process.argv[idx + 1]) : undefined;
}

async function main() {
  const { verifySpotifyLinks } = await import("../src/db/actions/spotify-verify-core.js");
  const prefix = IS_DRY_RUN ? "[DRY RUN] " : "";

  const summary = await verifySpotifyLinks({
    limit: readNumberArg("--limit") ?? DEFAULT_LIMIT,
    isDryRun: IS_DRY_RUN,
    log: (line) => console.log(line),
  });

  console.log(
    `\n${prefix}Done. checked=${summary.checked} alreadyCorrect=${summary.alreadyCorrect} rematched=${summary.rematched} ` +
      `cleared=${summary.cleared} skipped=${summary.skipped}` +
      (summary.abortedBecause ? `\nABORTED: ${summary.abortedBecause} — nothing was cleared by the failing call. Run again later.` : "")
  );
  if (summary.abortedBecause) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
