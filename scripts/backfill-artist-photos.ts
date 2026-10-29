/**
 * Gives artists a Resident Advisor profile photo (RA first, then Spotify).
 *
 * RA's curated DJ photos are far more reliable than a Spotify name search —
 * see src/db/actions/artist-photo-core.ts. Works through lineup artists that
 * haven't been tried within the recheck window: those in upcoming lineups
 * first, ones whose RA id is already known first within that. An artist's RA
 * profile is only used when its name matches ours; admin-locked photos are
 * never touched. Each artist it settles is stamped, so a run can simply be
 * repeated to continue (the daily maintenance cron does the same in batches).
 *
 * Always run with --dry-run first: it prints what would change and writes nothing.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env.local scripts/backfill-artist-photos.ts --dry-run [--limit N]
 *   npx tsx --env-file=.env.local scripts/backfill-artist-photos.ts [--limit N]
 */

export {};

const IS_DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_LIMIT = 200;

function readNumberArg(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? Number(process.argv[idx + 1]) : undefined;
}

async function main() {
  const { runArtistPhotoBackfill } = await import("../src/db/actions/artist-photo-core.js");
  const prefix = IS_DRY_RUN ? "[DRY RUN] " : "";

  const summary = await runArtistPhotoBackfill({
    limit: readNumberArg("--limit") ?? DEFAULT_LIMIT,
    isDryRun: IS_DRY_RUN,
    log: (line) => console.log(`${prefix}${line}`),
  });

  console.log(
    `\n${prefix}Done. checked=${summary.checked} newPhotos=${summary.newPhotos} replacedPhotos=${summary.replacedPhotos} ` +
      `raNoPhoto=${summary.raNoPhoto} notOnRa=${summary.notOnRa} nameMismatches=${summary.nameMismatches} errors=${summary.errors}` +
      (summary.aborted ? " ABORTED (too many failed RA requests in a row)" : "")
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
