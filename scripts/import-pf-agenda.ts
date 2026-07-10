/**
 * Manually run the Partyflock daily agenda import (imports the next 6 months of
 * events). Useful for the initial backfill — which can take minutes and would
 * exceed the cron route's function timeout — and for ad-hoc re-runs.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env scripts/import-pf-agenda.ts
 */

export {};

async function main() {
  const { importPFAgenda } = await import(
    "../src/db/actions/festival-import-pf-agenda.js"
  );

  // No deadline: run to completion regardless of how long the batch takes.
  const summary = await importPFAgenda();

  console.log("Partyflock agenda import complete:");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
