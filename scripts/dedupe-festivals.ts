/**
 * Detect and (optionally) hard-merge duplicate festival editions — the same
 * real-world event split across multiple rows (typically one row per day, or
 * duplicates re-scraped from different sources). See festival-merge.ts for
 * the merge itself; this script only finds and scores candidate clusters.
 *
 * A cluster must satisfy ALL of:
 *  - year-stripped name similarity >= NAME_SIM_THRESHOLD (Jaccard over
 *    normalized word tokens — same normalizer as link-pf-timetables.ts)
 *  - same "locality" key (first comma-part of `location`, lowercased) — this
 *    is what keeps a touring festival's different cities/venues apart (e.g.
 *    "TAPT Festival" plays 11 different Dutch cities) without needing a real
 *    city column
 *  - contiguous dates: consecutive dates within the group differ by at most
 *    1 day, split into runs, each run capped at MAX_RUN_DAYS
 *  - identical event-type marker set (after/afterparty/opening/closing/
 *    warmup/pre/kickoff/indoor/upclose/...) — stops "X Festival" merging with
 *    "X Festival After" on the same date and locality
 *
 * Only auto-merges when --dry-run is NOT passed. Always run with --dry-run
 * first and read the full report before merging anything for real.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env.local scripts/dedupe-festivals.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/dedupe-festivals.ts
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");
const NAME_SIM_THRESHOLD = 0.7;
const MAX_RUN_DAYS = 10;
const MARKER_WORDS = [
  "after", "afterparty", "preparty", "aftermovie", "opening", "closing",
  "warmup", "pre", "kickoff", "indoor", "upclose", "special",
];
const YEAR_TOKEN = /^(19|20)\d{2}$/;

/** Lowercase, strip diacritics/punctuation, collapse whitespace. */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeForMatch(text).split(" ").filter(Boolean));
}

/** Word tokens with any 4-digit year stripped, so "X 2026" ~ "X" scores 1.0. */
function nameTokensNoYear(name: string): Set<string> {
  return new Set([...tokenSet(name)].filter((t) => !YEAR_TOKEN.test(t)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function markerSet(name: string): Set<string> {
  const tokens = tokenSet(name);
  return new Set(MARKER_WORDS.filter((m) => tokens.has(m)));
}

function sameMarkerSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const m of a) if (!b.has(m)) return false;
  return true;
}

// RA's search-path event parser doesn't drop the literal area name "All" the
// way the import path does (see festival-import-ra.ts), so ~70 RA rows have
// `location = "All"` — never treat that as a real city.
const INVALID_CITY_VALUES = new Set(["all"]);

function cityKey(location: string | null): string | null {
  if (!location) return null;
  const first = location.split(",")[0]?.trim().toLowerCase();
  if (!first || INVALID_CITY_VALUES.has(first)) return null;
  return first;
}

function venueKey(venue: string | null): string | null {
  return venue?.trim().toLowerCase() || null;
}

/**
 * Two rows count as the same locality if EITHER their city OR their venue
 * matches — neither signal is reliable alone on the live data: RA's `venue`
 * is sometimes the promoter/event name rather than the actual site (e.g. one
 * Tomorrowland row has venue="Tomorrowland" instead of "De Schorre"), the
 * same real venue is spelled slightly differently across sources often
 * enough to matter (e.g. "Ruigenhoek" vs "Ruigenhoekse Polder" for the same
 * Soenda Festival edition), and RA's `location` has the "All" bug above. An
 * OR of both survives any one of these being wrong for a given row.
 */
function sameLocality(a: Row, b: Row): boolean {
  const cityA = cityKey(a.location);
  const cityB = cityKey(b.location);
  if (cityA && cityB && cityA === cityB) return true;
  const venueA = venueKey(a.venue);
  const venueB = venueKey(b.venue);
  return !!venueA && !!venueB && venueA === venueB;
}

/** A human-readable label for the cluster, not a grouping key. */
function describeLocality(run: Row[]): string {
  return venueKey(run[0].venue) ?? cityKey(run[0].location) ?? "unknown";
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

type Row = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  venue: string | null;
  source: string | null;
  artistCount: number;
  slotCount: number;
};

type Cluster = { locality: string; run: Row[] };

/**
 * Union-find over ALL festivals matching on name similarity + marker-set +
 * locality together (not locality-bucketed first — `sameLocality` isn't a
 * single hash key, since a row can match on city OR venue independently).
 * O(n²) pairs, but each comparison is cheap set/string work, and this is a
 * manual admin script, not a hot path.
 */
function clusterByNameMarkersAndLocality(rows: Row[]): Row[][] {
  const candidates = rows.filter((r) => cityKey(r.location) || venueKey(r.venue));

  const parent = new Map(candidates.map((r) => [r.id, r.id]));
  function find(id: string): string {
    let cur = id;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    return cur;
  }
  function union(a: string, b: string) {
    parent.set(find(a), find(b));
  }

  const tokensById = new Map(candidates.map((r) => [r.id, nameTokensNoYear(r.name)]));
  const markersById = new Map(candidates.map((r) => [r.id, markerSet(r.name)]));

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (jaccard(tokensById.get(a.id)!, tokensById.get(b.id)!) < NAME_SIM_THRESHOLD) continue;
      if (!sameMarkerSet(markersById.get(a.id)!, markersById.get(b.id)!)) continue;
      if (!sameLocality(a, b)) continue;
      union(a.id, b.id);
    }
  }

  const groupsByRoot = new Map<string, Row[]>();
  for (const r of candidates) {
    const root = find(r.id);
    const list = groupsByRoot.get(root) ?? [];
    list.push(r);
    groupsByRoot.set(root, list);
  }
  return [...groupsByRoot.values()].filter((g) => g.length >= 2);
}

/** Split a name/locality-matched group into contiguous-date (gap <= 1 day) runs. */
function splitIntoDateRuns(members: Row[]): Row[][] {
  const sorted = [...members].sort((a, b) => a.date.localeCompare(b.date));
  const runs: Row[][] = [];
  let run = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i - 1].date, sorted[i].date) <= 1) {
      run.push(sorted[i]);
    } else {
      if (run.length >= 2) runs.push(run);
      run = [sorted[i]];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

function findClusters(rows: Row[]): { clusters: Cluster[]; droppedForSpan: number } {
  const clusters: Cluster[] = [];
  let droppedForSpan = 0;
  for (const nameGroup of clusterByNameMarkersAndLocality(rows)) {
    for (const run of splitIntoDateRuns(nameGroup)) {
      const span = daysBetween(run[0].date, run[run.length - 1].date);
      if (span > MAX_RUN_DAYS) {
        droppedForSpan++;
        continue;
      }
      clusters.push({ locality: describeLocality(run), run });
    }
  }
  return { clusters, droppedForSpan };
}

const SOURCE_PRIORITY: Record<string, number> = { festivalfans: 3, partyflock: 2, ra: 1 };

/** Score highest-first: most artists, then has a timetable, then source preference. */
function pickWinner(run: Row[]): Row {
  return [...run].sort((a, b) => {
    if (a.artistCount !== b.artistCount) return b.artistCount - a.artistCount;
    const aHasSlots = a.slotCount > 0 ? 1 : 0;
    const bHasSlots = b.slotCount > 0 ? 1 : 0;
    if (aHasSlots !== bHasSlots) return bHasSlots - aHasSlots;
    const aPriority = SOURCE_PRIORITY[a.source ?? ""] ?? 0;
    const bPriority = SOURCE_PRIORITY[b.source ?? ""] ?? 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    return a.id.localeCompare(b.id);
  })[0];
}

async function main() {
  const { db } = await import("../src/db/index.js");
  const schema = await import("../src/db/schema.js");
  const { sql } = await import("drizzle-orm");
  const { mergeFestivalsCore } = await import("../src/db/actions/festival-merge.js");

  const prefix = DRY_RUN ? "[DRY RUN] " : "";

  // Raw SQL rather than Drizzle's query builder: a computed subquery column
  // interpolating a table column inside `.select({ ... sql`...` })` doesn't
  // reliably correlate to the right outer table once mixed with the query
  // builder — same reasoning as the festival-search.ts rewrite (see its
  // comment), just hit from the other direction (this failed with "operator
  // does not exist: text = uuid", i.e. it silently resolved to some other
  // table's "id" column instead of festivals.id).
  const result = await db.execute(sql`
    SELECT
      f.id AS "id",
      f.name AS "name",
      f.date AS "date",
      f.location AS "location",
      f.venue AS "venue",
      f.source AS "source",
      (SELECT count(*)::int FROM ${schema.festivalArtists} fa WHERE fa.festival_id = f.id) AS "artistCount",
      (SELECT count(*)::int FROM ${schema.festivalTimetableSlots} ts WHERE ts.festival_id = f.id) AS "slotCount"
    FROM ${schema.festivals} f
  `);
  const rows = result.rows as unknown as Row[];

  console.log(`${prefix}${rows.length} festival(s) loaded.`);

  const { clusters, droppedForSpan } = findClusters(rows);
  const spanNote = droppedForSpan > 0 ? ` (${droppedForSpan} dropped for exceeding ${MAX_RUN_DAYS}-day span)` : "";
  console.log(`${prefix}${clusters.length} candidate cluster(s) found${spanNote}.\n`);

  let clustersProcessed = 0;
  let rowsAbsorbed = 0;

  for (const { locality, run } of clusters) {
    const winner = pickWinner(run);
    const losers = run.filter((r) => r.id !== winner.id);
    const summary = run
      .map((r) => `${r.id} (${r.date}, "${r.name}", artists=${r.artistCount}, slots=${r.slotCount})`)
      .join("\n    + ");
    console.log(`  [locality: ${locality}]\n    ${summary}\n    -> winner: ${winner.id}`);

    if (DRY_RUN) {
      clustersProcessed++;
      continue;
    }

    try {
      const result = await mergeFestivalsCore(winner.id, losers.map((r) => r.id));
      console.log(`    merged ${result.mergedLoserIds.length} row(s) into ${winner.id}`);
      rowsAbsorbed += result.mergedLoserIds.length;
      clustersProcessed++;
    } catch (err) {
      console.error(`    FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(
    `\n${prefix}Done. ${clustersProcessed}/${clusters.length} cluster(s) ${DRY_RUN ? "would be merged" : "merged"}` +
      (DRY_RUN ? "" : ` (${rowsAbsorbed} row(s) absorbed).`)
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
