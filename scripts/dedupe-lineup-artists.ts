/**
 * One-off cleanup: lineups that list the same artist twice under spellings
 * that differ only by accents or punctuation ("Adrián Mills" / "Adrian Mills",
 * "L.F.T." / "L.F.T"). Each duplicate is merged into the better record within
 * that festival (ratings, picks and slots move across; a redirect is recorded
 * so re-imports can't bring it back). New imports already prevent these.
 *
 * Always run with --dry-run first and read the list — a few pairs may be
 * genuinely different artists.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env.local scripts/dedupe-lineup-artists.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/dedupe-lineup-artists.ts
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const { runLineupDedupe } = await import("../src/db/actions/lineup-dedupe-core.js");
  const summary = await runLineupDedupe({ dryRun: DRY_RUN, log: (line) => console.log(line) });

  for (const error of summary.errors) console.error(`  ! ${error}`);
  console.log(
    `\n${DRY_RUN ? "[DRY RUN] " : ""}Done. ${summary.groups} duplicate group(s)` +
      (DRY_RUN ? "." : `, merged ${summary.merged} duplicate(s), ${summary.errors.length} error(s).`)
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
