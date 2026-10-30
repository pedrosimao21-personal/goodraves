/**
 * Reads every RA festival's days and clock times from Resident Advisor.
 *
 * Fixes two things in one pass: overnight parties stored as two-day events
 * (a Saturday 16:00 - Sunday 04:00 party is a one-day event, see
 * src/lib/event-schedule.ts), and dates RA has since changed. Fills in the
 * announced start/end times. A festival that other entries were merged into, or
 * whose corrected date would clash with another festival of the same name, or
 * whose RA dates look wrong (years apart), keeps its dates (it still gets its
 * times) and is listed as KEPT.
 *
 * Always run with --dry-run first: it prints every change and writes nothing.
 * Each festival it settles is stamped, so a run can simply be repeated to continue.
 *
 * Usage (needs DATABASE_URL):
 *   node node_modules/tsx/dist/cli.mjs --env-file=.env.local scripts/backfill-festival-schedules.ts --dry-run [--limit N]
 *   node node_modules/tsx/dist/cli.mjs --env-file=.env.local scripts/backfill-festival-schedules.ts [--limit N]
 */

export {};

const IS_DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_LIMIT = 2000;

function readNumberArg(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? Number(process.argv[idx + 1]) : undefined;
}

async function main() {
  const { runScheduleBackfill } = await import("../src/db/actions/festival-ra-schedule-core.js");
  const prefix = IS_DRY_RUN ? "[DRY RUN] " : "";

  const summary = await runScheduleBackfill({
    limit: readNumberArg("--limit") ?? DEFAULT_LIMIT,
    isDryRun: IS_DRY_RUN,
    log: (line) => console.log(`${prefix}${line}`),
  });

  console.log(
    `\n${prefix}Done. checked=${summary.checked} daysChanged=${summary.datesChanged} daysKept=${summary.datesKept} ` +
      `timesAdded=${summary.timesAdded} unchanged=${summary.unchanged} unavailable=${summary.unavailable}` +
      (summary.aborted ? " ABORTED (RA stopped answering)" : "")
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
