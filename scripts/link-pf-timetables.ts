/**
 * Best-effort backfill: find festivals (any date) with no timetable and no
 * Partyflock link, search Partyflock by name, and auto-link + import for
 * confident matches. The matching logic lives in
 * src/db/actions/festival-timetable-autolink.ts, which the daily-maintenance
 * cron also runs for upcoming festivals; this script is the full,
 * all-dates version (and ignores the cron's per-festival recheck interval).
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env.local scripts/link-pf-timetables.ts [--dry-run]
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const { autoLinkPFTimetables } = await import("../src/db/actions/festival-timetable-autolink.js");

  const prefix = DRY_RUN ? "[DRY RUN] " : "";
  console.log(`${prefix}Finding festivals with no timetable and no Partyflock link...`);

  const summary = await autoLinkPFTimetables({ dryRun: DRY_RUN, log: (line) => console.log(line) });
  for (const error of summary.errors) console.error(`  FAILED: ${error}`);

  console.log(
    `\n${prefix}Done. Linked: ${summary.linked}, needs review: ${summary.needsReview}, ` +
      `no match: ${summary.noMatch}, failed: ${summary.failed}.`
  );
  if (summary.needsReview > 0) {
    console.log(`Review the "REVIEW" candidates above via the admin "Link Partyflock Timetable" action on each festival page.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
