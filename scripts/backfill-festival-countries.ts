/**
 * One-off backfill: populate festivals.country_code / country_name for
 * existing rows imported before those columns existed. Two passes:
 *
 *  1. Rows whose `location` already has a "City, Country" comma — resolve
 *     the country segment through the local name map (fast, no network).
 *  2. City-only rows (today: ~663, all Resident Advisor imports, which never
 *     included a country) — geocode the city via Nominatim, rate-limited to
 *     its 1 req/s policy. Also backfills lat/lng for rows that had none
 *     (only 1 of the 663 currently does), since the geocode call returns it
 *     for free.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env.local scripts/backfill-festival-countries.ts [--dry-run]
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");
const NOMINATIM_DELAY_MS = 1100; // stay under Nominatim's 1 req/s usage policy
const GEOCODE_RETRIES = 2; // covers isolated timeouts within the same request
const PROGRESS_LOG_INTERVAL = 50;
// A live comparison showed well-known cities (Toronto, Istanbul, Buenos
// Aires...) failing consistently for the whole ~13 min run even with
// per-request retries, while working instantly in isolation — sustained-use
// throttling from Nominatim's public instance, not a real miss or a random
// blip. A short in-run retry can't out-wait that; a cooldown pause plus a
// slower final pass, after the main run is done, can.
const COOLDOWN_MS = 15_000;
const FINAL_PASS_DELAY_MS = 3000;

async function main() {
  const { db } = await import("../src/db/index.js");
  const schema = await import("../src/db/schema.js");
  const { or, isNull, eq } = await import("drizzle-orm");
  const {
    extractCountryFromLocation,
    normalizeCountryName,
    getCountryIsoCode,
    getCountryNameFromIsoCode,
  } = await import("../src/utils/location-normalizer.js");
  const { geocodeLocation } = await import("../src/utils/geocoding.js");
  const { sleep } = await import("../src/lib/retry.js");

  async function geocodeWithRetry(location: string, delayMs: number) {
    for (let attempt = 0; attempt <= GEOCODE_RETRIES; attempt++) {
      const result = await geocodeLocation(location, { addressDetails: true }).catch(() => null);
      if (result?.countryCode) return result;
      if (attempt < GEOCODE_RETRIES) await sleep(delayMs * 2 ** attempt);
    }
    return null;
  }

  const prefix = DRY_RUN ? "[DRY RUN] " : "";

  const targets = await db
    .select({
      id: schema.festivals.id,
      location: schema.festivals.location,
      latitude: schema.festivals.latitude,
      longitude: schema.festivals.longitude,
    })
    .from(schema.festivals)
    .where(or(isNull(schema.festivals.countryCode), isNull(schema.festivals.countryName)));

  console.log(`${prefix}${targets.length} festival(s) missing a country.\n`);

  const withComma = targets.filter((f) => extractCountryFromLocation(f.location));
  const cityOnly = targets.filter((f) => !extractCountryFromLocation(f.location));

  const unresolved: string[] = [];
  let resolvedFromLocation = 0;
  let resolvedFromGeocode = 0;

  // ── Pass 1: "City, Country" rows — no network needed ──────────────────
  for (const f of withComma) {
    const rawCountry = extractCountryFromLocation(f.location)!;
    const countryName = normalizeCountryName(rawCountry);
    const countryCode = getCountryIsoCode(countryName);

    if (!countryCode) {
      unresolved.push(`${f.id} (location="${f.location}", unrecognized country "${rawCountry}")`);
      continue;
    }

    resolvedFromLocation++;
    if (!DRY_RUN) {
      await db
        .update(schema.festivals)
        .set({ countryCode, countryName })
        .where(eq(schema.festivals.id, f.id));
    }
  }

  console.log(`${prefix}Resolved ${resolvedFromLocation}/${withComma.length} from the location string.`);

  // A single city-only row's geocode-and-persist attempt. Returns true if
  // resolved (and persisted, unless DRY_RUN); false leaves the row for the
  // caller to track as still-unresolved.
  async function tryResolveCityOnly(f: (typeof cityOnly)[number], delayMs: number): Promise<boolean> {
    if (!f.location) return false;

    const geocoded = await geocodeWithRetry(f.location, delayMs);
    const countryCode = geocoded?.countryCode ?? null;
    const countryName = getCountryNameFromIsoCode(countryCode);
    if (!countryCode || !countryName) return false;

    resolvedFromGeocode++;
    if (!DRY_RUN) {
      await db
        .update(schema.festivals)
        .set({
          countryCode,
          countryName,
          // Backfill coordinates too — this row had none for lat/lng lookups
          // (the heatmap etc.) if it's still null; don't overwrite a real one.
          latitude: f.latitude ?? geocoded.latitude,
          longitude: f.longitude ?? geocoded.longitude,
        })
        .where(eq(schema.festivals.id, f.id));
    }
    return true;
  }

  // ── Pass 2: city-only rows — geocode the city itself ───────────────────
  const etaMin = Math.ceil((cityOnly.length * NOMINATIM_DELAY_MS) / 1000 / 60);
  console.log(`${prefix}Geocoding ${cityOnly.length} city-only row(s) via Nominatim (~${etaMin} min)...\n`);

  const stillUnresolved: typeof cityOnly = [];

  for (let i = 0; i < cityOnly.length; i++) {
    const f = cityOnly[i];
    if (!f.location) {
      unresolved.push(`${f.id} (no location at all)`);
      continue;
    }

    const resolved = await tryResolveCityOnly(f, NOMINATIM_DELAY_MS);
    await sleep(NOMINATIM_DELAY_MS);
    if (!resolved) stillUnresolved.push(f);

    if ((i + 1) % PROGRESS_LOG_INTERVAL === 0) {
      console.log(`${prefix}  ${i + 1}/${cityOnly.length} geocoded...`);
    }
  }

  // ── Pass 3: retry whatever Pass 2 missed, after a cooldown ──────────────
  // A slower, separate pass — see the COOLDOWN_MS/FINAL_PASS_DELAY_MS comment
  // above — recovers most of what looked like real misses but were actually
  // still inside Nominatim's sustained-use throttling window from Pass 2.
  if (stillUnresolved.length > 0) {
    console.log(
      `\n${prefix}${stillUnresolved.length} row(s) still unresolved after the main pass — ` +
        `cooling down ${COOLDOWN_MS / 1000}s before a slower retry pass...`
    );
    await sleep(COOLDOWN_MS);

    for (const f of stillUnresolved) {
      const resolved = await tryResolveCityOnly(f, FINAL_PASS_DELAY_MS);
      await sleep(FINAL_PASS_DELAY_MS);
      if (!resolved) unresolved.push(`${f.id} (location="${f.location}", geocode miss)`);
    }
  }

  console.log(
    `\n${prefix}Done. Resolved: ${resolvedFromLocation + resolvedFromGeocode}/${targets.length} ` +
      `(${resolvedFromLocation} from location, ${resolvedFromGeocode} from geocoding). ` +
      `Unresolved: ${unresolved.length}.`
  );

  if (unresolved.length > 0) {
    console.log(`\nUnresolved rows (left with no country rather than guessing):`);
    for (const line of unresolved) console.log(`  ${line}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
