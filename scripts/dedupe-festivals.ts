/**
 * Detect and (optionally) hard-merge duplicate festival rows — the same
 * real-world event split across multiple rows (one row per day, or the same
 * event imported from RA, FestivalFans and Partyflock under different
 * names). The rules live in src/lib/festival-match.ts and the run itself in
 * src/db/actions/festival-dedupe-core.ts, which the daily-maintenance cron
 * also runs. Uncertain pairs are queued for review on /admin/duplicates.
 *
 * Always run with --dry-run first and read the full report. A real run
 * merges at most --max-merges clusters (default 25, same as the cron) and
 * merges nothing if it finds more than --abort-above clusters (default 60) —
 * pass higher values deliberately for a one-off backlog cleanup.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env.local scripts/dedupe-festivals.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/dedupe-festivals.ts [--max-merges N] [--abort-above N]
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");

function readNumberArg(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? Number(process.argv[idx + 1]) : undefined;
}

async function main() {
  const { runDedupe } = await import("../src/db/actions/festival-dedupe-core.js");
  const prefix = DRY_RUN ? "[DRY RUN] " : "";

  const summary = await runDedupe({
    dryRun: DRY_RUN,
    maxMerges: readNumberArg("--max-merges"),
    abortAboveClusters: readNumberArg("--abort-above"),
    log: (line) => console.log(line),
  });

  for (const error of summary.errors) console.error(`  ! ${error}`);
  console.log(
    `\n${prefix}Done. ${summary.festivals} festivals, ${summary.clusters} confident cluster(s), ` +
      `${summary.oversizedClusters} oversized (left alone), ${summary.reviewQueued} pair(s) for review.` +
      (DRY_RUN ? "" : ` Merged ${summary.merged} cluster(s), absorbed ${summary.rowsAbsorbed} row(s), renamed ${summary.renamed}.`) +
      (summary.aborted ? " ABORTED — nothing merged." : "")
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
