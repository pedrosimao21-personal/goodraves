/**
 * Manually run the daily timetable refresh (normally step 2 of the
 * daily-maintenance cron): re-sync the Partyflock timetable of every festival
 * in the next TIMETABLE_REFRESH_DAYS_AHEAD days that has a Partyflock source.
 * See src/db/actions/festival-timetable-refresh.ts.
 *
 * --dry-run fetches and compares but writes nothing (not even new artists).
 * A real run doesn't revalidate Next's cache (no request context here) — the
 * timetable cache expires on its own within the hour.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env.local scripts/refresh-timetables.ts [--dry-run]
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const { refreshUpcomingTimetables } = await import("../src/db/actions/festival-timetable-refresh.js");
  const prefix = DRY_RUN ? "[DRY RUN] " : "";

  const summary = await refreshUpcomingTimetables({ dryRun: DRY_RUN, log: (line) => console.log(line) });
  for (const error of summary.errors) console.error(`  ! ${error}`);

  console.log(
    `\n${prefix}Done. ${summary.festivals} upcoming festival(s), ${summary.sources} Partyflock source(s): ` +
      `${summary.updated} ${DRY_RUN ? "would change" : "updated"}, ${summary.unchanged} unchanged, ` +
      `${summary.noTimetable} without a timetable yet, ${summary.dateMismatch} date mismatch, ` +
      `${summary.skippedShrink} skipped (suspicious shrink), ${summary.failed} failed.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
