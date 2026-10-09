/**
 * Repairs Partyflock festivals stored under their title alone. Partyflock
 * names a party "Title · Subtitle", and the title alone cannot tell separate
 * parties of one organiser apart ("Awakenings: Sunday Sessions" vs
 * "Awakenings: Drumcode"), so such rows can sit in one merged cluster. This
 * restores subtitle-based names and un-merges those clusters in three phases:
 *
 *  1. Stale merge records: a festival_merges row whose loser is a live
 *     festival row again. Deleted. When the recorded winner is live too, it
 *     still holds the loser's copied lineup, so it joins phase 2.
 *  2. Un-merge: every merge into WRONG_MERGE_WINNERS (plus phase 1's live
 *     winners) is undone by deleting the merge records and force re-importing
 *     the winner and each loser from their own Partyflock pages. A cluster is
 *     skipped when a loser is not a Partyflock row, its snapshot holds user
 *     attendance/ratings (a re-import would not restore those), or a page no
 *     longer parses.
 *  3. Rename: upcoming Partyflock rows whose stored name lacks the subtitle get
 *     the full name. Merge winners are reported, not renamed: their own page's
 *     subtitle names one day of a multi-day festival.
 *
 * Usage (needs DATABASE_URL):
 *   npx tsx --env-file=.env scripts/repair-pf-merges.ts --dry-run
 *   npx tsx --env-file=.env scripts/repair-pf-merges.ts
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");
const PF_ID = /^pf-(\d+)$/;

/** Clusters confirmed as separate parties by their differing Partyflock subtitles. */
const WRONG_MERGE_WINNERS = [
  "pf-496509", // Awakenings ADE: Metamorfosi / Trip To Galaxy / Sunday Sessions
  "pf-496248", // Intercell ADE: seven "… Invites" nights
  "pf-494723", // Nachtwacht XL Festival vs Nachtwacht: The Return
];

type Db = typeof import("../src/db/index.js")["db"];
type Schema = typeof import("../src/db/schema.js");
type Parsed = ReturnType<typeof import("../src/services/partyflock/parser.js")["parsePFEventPage"]>;

async function main() {
  const { db } = await import("../src/db/index.js");
  const schema = await import("../src/db/schema.js");
  const { fetchPFEventHtml } = await import("../src/services/partyflock/client.js");
  const { parsePFEventPage } = await import("../src/services/partyflock/parser.js");
  const { importPFEvent } = await import("../src/db/actions/festival-import-pf-core.js");
  const { sleep } = await import("../src/lib/retry.js");
  const { PF_AGENDA_REQUEST_DELAY_MS } = await import("../src/lib/constants.js");
  const { eq, inArray, and, gte, like } = await import("drizzle-orm");
  const { festivals, festivalMerges } = schema;

  const prefix = DRY_RUN ? "[dry-run] " : "";
  const pageCache = new Map<string, Parsed | null>();

  async function fetchParsed(festivalId: string): Promise<Parsed | null> {
    if (pageCache.has(festivalId)) return pageCache.get(festivalId)!;
    const partyId = PF_ID.exec(festivalId)?.[1];
    const html = partyId ? await fetchPFEventHtml(partyId) : null;
    const parsed = html ? parsePFEventPage(html) : null;
    pageCache.set(festivalId, parsed?.name ? parsed : null);
    await sleep(PF_AGENDA_REQUEST_DELAY_MS);
    return pageCache.get(festivalId)!;
  }

  async function nameDateHolder(name: string, date: string): Promise<string | null> {
    const [row] = await db
      .select({ id: festivals.id })
      .from(festivals)
      .where(and(eq(festivals.name, name), eq(festivals.date, date)))
      .limit(1);
    return row?.id ?? null;
  }

  const liveIds = new Set((await db.select({ id: festivals.id }).from(festivals)).map((r) => r.id));
  const merges = await db.select().from(festivalMerges);

  // ── Phase 1 ─────────────────────────────────────────────
  const stale = merges.filter((m) => liveIds.has(m.loserId));
  const liveWinnersOfStale = [...new Set(stale.filter((m) => liveIds.has(m.winnerId)).map((m) => m.winnerId))];
  console.log(`\n${prefix}Phase 1: ${stale.length} stale merge record(s) (loser row is live)`);
  for (const m of stale) {
    const tag = liveIds.has(m.winnerId) ? "winner live → un-merge in phase 2" : "winner gone (reverse half of a cycle)";
    console.log(`  delete ${m.loserId} -> ${m.winnerId}  [${tag}]`);
  }
  if (!DRY_RUN && stale.length > 0) {
    await db.delete(festivalMerges).where(inArray(festivalMerges.loserId, stale.map((m) => m.loserId)));
  }

  // ── Phase 2 ─────────────────────────────────────────────
  const winners = [...new Set([...WRONG_MERGE_WINNERS, ...liveWinnersOfStale])];
  const restored = new Set<string>();
  console.log(`\n${prefix}Phase 2: un-merge ${winners.length} cluster(s)`);
  for (const winnerId of winners) {
    const records = merges.filter((m) => m.winnerId === winnerId);
    const [current] = await db.select().from(festivals).where(eq(festivals.id, winnerId)).limit(1);
    console.log(`\n  ${winnerId} now: "${current?.name}" ${current?.date}..${current?.endDate ?? ""}`);
    const problem = await checkCluster(winnerId, records, liveIds, fetchParsed);
    if (problem) {
      console.log(`    SKIP: ${problem}`);
      continue;
    }
    for (const id of [winnerId, ...records.map((r) => r.loserId)]) {
      const p = (await fetchParsed(id))!;
      const holder = await nameDateHolder(p.name!, p.date ?? "");
      const clash = holder && holder !== id ? `  !! name+date held by ${holder}` : "";
      console.log(`    ${id === winnerId ? "rebuild " : "restore "}${id}: "${p.name}" ${p.date} lineup=${p.lineup.length} slots=${p.timetable.length}${clash}`);
    }
    if (DRY_RUN) continue;
    const loserIds = records.map((r) => r.loserId);
    if (loserIds.length) await db.delete(festivalMerges).where(inArray(festivalMerges.loserId, loserIds));
    for (const id of [winnerId, ...loserIds]) {
      const result = await importPFEvent(PF_ID.exec(id)![1], { force: true });
      console.log(`    imported ${id} -> ${result ?? "FAILED"}`);
      restored.add(id);
      await sleep(PF_AGENDA_REQUEST_DELAY_MS);
    }
  }
  if (DRY_RUN) for (const w of winners) for (const m of merges.filter((r) => r.winnerId === w)) restored.add(m.loserId);
  for (const w of winners) restored.add(w);

  // ── Phase 3 ─────────────────────────────────────────────
  await renameUpcoming({ db, schema, restored, fetchParsed, nameDateHolder, prefix, dryRun: DRY_RUN, ops: { eq, and, gte, like } });
}

type CheckFetch = (festivalId: string) => Promise<Parsed | null>;

async function checkCluster(
  winnerId: string,
  records: { loserId: string; snapshot: string }[],
  liveIds: Set<string>,
  fetchParsed: CheckFetch
): Promise<string | null> {
  if (!liveIds.has(winnerId)) return "winner row not found";
  for (const r of records) {
    if (!PF_ID.test(r.loserId)) return `loser ${r.loserId} is not a Partyflock row`;
    const snap = JSON.parse(r.snapshot) as { attendance?: unknown[]; artistRatings?: unknown[] };
    if ((snap.attendance?.length ?? 0) + (snap.artistRatings?.length ?? 0) > 0) {
      return `loser ${r.loserId} snapshot holds user attendance/ratings`;
    }
  }
  for (const id of [winnerId, ...records.map((r) => r.loserId)]) {
    const p = await fetchParsed(id);
    if (!p?.date) return `Partyflock page for ${id} did not parse`;
  }
  return null;
}

type RenameArgs = {
  db: Db;
  schema: Schema;
  restored: Set<string>;
  fetchParsed: CheckFetch;
  nameDateHolder: (name: string, date: string) => Promise<string | null>;
  prefix: string;
  dryRun: boolean;
  ops: Pick<typeof import("drizzle-orm"), "eq" | "and" | "gte" | "like">;
};

async function renameUpcoming({ db, schema, restored, fetchParsed, nameDateHolder, prefix, dryRun, ops }: RenameArgs) {
  const { festivals, festivalMerges } = schema;
  const today = new Date().toISOString().slice(0, 10);
  const winnerIds = new Set((await db.select({ id: festivalMerges.winnerId }).from(festivalMerges)).map((r) => r.id));
  const rows = (
    await db
      .select({ id: festivals.id, name: festivals.name, date: festivals.date })
      .from(festivals)
      .where(ops.and(ops.like(festivals.id, "pf-%"), ops.gte(festivals.date, today)))
  ).filter((r) => PF_ID.test(r.id) && !restored.has(r.id));

  console.log(`\n${prefix}Phase 3: check names of ${rows.length} upcoming Partyflock row(s)`);
  let renamed = 0;
  for (const row of rows) {
    const p = await fetchParsed(row.id);
    if (!p?.name || p.name === row.name) continue;
    if (winnerIds.has(row.id)) {
      console.log(`  keep   ${row.id} "${row.name}" (merge winner; own page says "${p.name}")`);
      continue;
    }
    const holder = await nameDateHolder(p.name, row.date);
    if (holder && holder !== row.id) {
      console.log(`  CLASH  ${row.id} "${row.name}" -> "${p.name}" held on ${row.date} by ${holder}`);
      continue;
    }
    console.log(`  rename ${row.id} ${row.date} "${row.name}" -> "${p.name}"`);
    renamed++;
    if (!dryRun) await db.update(festivals).set({ name: p.name }).where(ops.eq(festivals.id, row.id));
  }
  console.log(`\n${prefix}Done. ${renamed} row(s) ${dryRun ? "would be renamed" : "renamed"}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
