/**
 * Manually run the Partyflock refresh: re-fetch every imported Partyflock
 * festival sitting on a 7-day or 2-day checkpoint and replace its stored copy.
 * Useful for an immediate catch-up run and for ad-hoc testing without waiting
 * for the daily cron.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env scripts/refresh-pf-festivals.ts
 */

export {};

async function main() {
  const { refreshDuePFFestivals } = await import(
    "../src/db/actions/festival-refresh-pf.js"
  );

  // No deadline: run to completion regardless of how long the batch takes.
  const summary = await refreshDuePFFestivals();

  console.log("Partyflock refresh complete:");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
