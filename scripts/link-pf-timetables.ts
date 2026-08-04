/**
 * Best-effort backfill: find festivals with no timetable and no Partyflock
 * link, search Partyflock by name, and auto-link + import for confident
 * matches. An exact date match against the festival's stored date is a hard
 * gate before anything is even scored — Partyflock series/event pages can
 * resolve to whichever edition is "current", so date is the one signal that
 * can't be a false positive. Matches are then scored on normalized name +
 * venue/city similarity; only matches above the auto-link threshold are
 * imported. Lower-confidence matches are logged for manual review via the
 * admin "Link Partyflock Timetable" action on the festival page instead of
 * being guessed at.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env scripts/link-pf-timetables.ts [--dry-run]
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");

const NAME_SIM_AUTO_THRESHOLD = 0.6;
const NAME_SIM_REVIEW_THRESHOLD = 0.3;
const LOCATION_SIM_BONUS = 0.15;

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

/** Jaccard similarity between the word-token sets of two strings, 0..1. */
function nameSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Small flat bonus when venue/city strings share any token at all. */
function locationSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return nameSimilarity(a, b) > 0 ? LOCATION_SIM_BONUS : 0;
}

function buildPfUrl(pfId: string): string {
  return pfId.startsWith("event-")
    ? `https://partyflock.nl/event/${pfId.replace("event-", "")}`
    : `https://partyflock.nl/party/${pfId}`;
}

async function main() {
  const { db } = await import("../src/db/index.js");
  const schema = await import("../src/db/schema.js");
  const { isNull } = await import("drizzle-orm");
  const { searchPFEventsRaw } = await import("../src/services/partyflock/client.js");
  const { parsePFSearchResults } = await import("../src/services/partyflock/parser.js");
  const { importPFTimetable } = await import("../src/db/actions/festival-helpers.js");

  const prefix = DRY_RUN ? "[DRY RUN] " : "";
  console.log(`${prefix}Finding festivals with no timetable and no Partyflock link...`);

  const timetabled = await db
    .selectDistinct({ festivalId: schema.festivalTimetableSlots.festivalId })
    .from(schema.festivalTimetableSlots);
  const timetabledIds = new Set(timetabled.map((r: { festivalId: string }) => r.festivalId));

  const unlinked = await db
    .select({
      id: schema.festivals.id,
      name: schema.festivals.name,
      date: schema.festivals.date,
      venue: schema.festivals.venue,
      location: schema.festivals.location,
    })
    .from(schema.festivals)
    .where(isNull(schema.festivals.pfPartyId));

  const targets = unlinked.filter((f: { id: string }) => !timetabledIds.has(f.id));
  console.log(`${targets.length} festival(s) to check.\n`);

  let linked = 0;
  let needsReview = 0;
  let noMatch = 0;

  for (const festival of targets) {
    const html = await searchPFEventsRaw(festival.name);
    if (!html) {
      noMatch++;
      continue;
    }

    const dateMatches = parsePFSearchResults(html).filter((r) => r.date === festival.date);
    if (dateMatches.length === 0) {
      noMatch++;
      continue;
    }

    let best: { result: (typeof dateMatches)[number]; score: number } | null = null;
    for (const result of dateMatches) {
      const score =
        nameSimilarity(festival.name, result.name) +
        locationSimilarity(festival.venue ?? festival.location, result.venue ?? result.location);
      if (!best || score > best.score) best = { result, score };
    }
    if (!best || best.score < NAME_SIM_REVIEW_THRESHOLD) {
      noMatch++;
      continue;
    }

    const url = buildPfUrl(best.result.pfId);

    if (best.score < NAME_SIM_AUTO_THRESHOLD) {
      console.log(`  REVIEW: "${festival.name}" (${festival.date}) ~ "${best.result.name}" score=${best.score.toFixed(2)} — ${url}`);
      needsReview++;
      continue;
    }

    console.log(`  MATCH: "${festival.name}" (${festival.date}) = "${best.result.name}" score=${best.score.toFixed(2)} — ${url}`);

    if (DRY_RUN) {
      linked++;
      continue;
    }

    try {
      const result = await importPFTimetable(festival.id, url);
      console.log(`    imported ${result.slotCount} slot(s) across ${result.stageCount} stage(s) (${result.newArtistCount} new artist(s) added to the lineup)`);
      linked++;
    } catch (err) {
      console.error(`    FAILED: ${err instanceof Error ? err.message : err}`);
      needsReview++;
    }
  }

  console.log(`\n${prefix}Done. Linked: ${linked}, needs review: ${needsReview}, no match: ${noMatch}.`);
  if (needsReview > 0) {
    console.log(`Review the "REVIEW" candidates above via the admin "Link Partyflock Timetable" action on each festival page.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
