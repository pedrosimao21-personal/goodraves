/**
 * Daily duplicate-festival detection + merge. Deliberately no "use server" —
 * run by the daily-maintenance cron and scripts/dedupe-festivals.ts, never
 * from the client. The "is this the same event?" rules live in
 * lib/festival-match.ts; this file loads the data, groups confident pairs
 * into clusters, merges them via mergeFestivalsCore, and queues uncertain
 * pairs in festival_duplicate_candidates for an admin (/admin/duplicates).
 *
 * Safety (a wrong merge is recoverable from festival_merges' snapshot, but
 * only by hand): merges per run are capped, and if a run finds far more
 * confident clusters than a normal day could produce, it merges nothing and
 * reports instead — that pattern means a rule or the data broke, not that
 * the world suddenly doubled its festivals.
 */

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists, festivalDuplicateCandidates } from "@/db/schema";
import { classifyPair, type MatchRow } from "@/lib/festival-match";
import { mergeFestivalsCore } from "./festival-merge-core";
import { findExistingFestivalByNameDate } from "./festival-helpers";
import { groupIntoClusters, pickWinner, pickCleanestName, type DedupeRow } from "./festival-dedupe-cluster";

export interface DedupeOptions {
  dryRun?: boolean;
  /** Stop after this many cluster merges. */
  maxMerges?: number;
  /** Merge nothing if more than this many confident clusters are found. */
  abortAboveClusters?: number;
  log?: (line: string) => void;
  onMerged?: (winnerId: string, loserIds: string[]) => void;
}

export interface DedupeSummary {
  festivals: number;
  clusters: number;
  merged: number;
  rowsAbsorbed: number;
  renamed: number;
  reviewQueued: number;
  oversizedClusters: number;
  aborted: boolean;
  errors: string[];
}

const DEFAULT_MAX_MERGES = 25;
const DEFAULT_ABORT_ABOVE_CLUSTERS = 60;

async function loadRows(): Promise<DedupeRow[]> {
  const [festivalRows, lineupRows, attendance] = await Promise.all([
    db
      .select({
        id: festivals.id, name: festivals.name, date: festivals.date, endDate: festivals.endDate,
        location: festivals.location, venue: festivals.venue, latitude: festivals.latitude,
        longitude: festivals.longitude, pfPartyId: festivals.pfPartyId, source: festivals.source,
        updatedAt: festivals.updatedAt,
      })
      .from(festivals),
    db.select({ festivalId: festivalArtists.festivalId, artistId: festivalArtists.artistId }).from(festivalArtists),
    db.execute(sql`
      SELECT f.id AS "id",
        (SELECT count(*)::int FROM festival_timetable_slots ts WHERE ts.festival_id = f.id) AS "slotCount",
        (SELECT count(*)::int FROM user_festivals uf WHERE uf.festival_id = f.id) AS "attendeeCount"
      FROM festivals f
    `),
  ]);

  const artistsByFestival = new Map<string, Set<string>>();
  for (const r of lineupRows) {
    const set = artistsByFestival.get(r.festivalId) ?? new Set<string>();
    set.add(r.artistId);
    artistsByFestival.set(r.festivalId, set);
  }
  const countsById = new Map(
    (attendance.rows as { id: string; slotCount: number; attendeeCount: number }[]).map((r) => [r.id, r])
  );

  return festivalRows.map((f) => ({
    ...f,
    artistIds: artistsByFestival.get(f.id) ?? new Set<string>(),
    slotCount: countsById.get(f.id)?.slotCount ?? 0,
    attendeeCount: countsById.get(f.id)?.attendeeCount ?? 0,
    updatedAt: f.updatedAt.toISOString(),
  }));
}

async function loadDismissedPairs(): Promise<Set<string>> {
  const rows = await db
    .select({ a: festivalDuplicateCandidates.festivalA, b: festivalDuplicateCandidates.festivalB })
    .from(festivalDuplicateCandidates)
    .where(eq(festivalDuplicateCandidates.status, "dismissed"));
  return new Set(rows.map((r) => `${r.a}|${r.b}`));
}

export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

type ClassifiedPairs = { auto: [MatchRow, MatchRow][]; review: { a: string; b: string; reason: string }[] };

/** O(n²) over all rows, but the date check rejects almost every pair immediately. */
function classifyAllPairs(rows: DedupeRow[], dismissed: Set<string>): ClassifiedPairs {
  const sorted = [...rows].sort((x, y) => x.date.localeCompare(y.date));
  const result: ClassifiedPairs = { auto: [], review: [] };
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const [a, b] = pairKey(sorted[i].id, sorted[j].id);
      if (dismissed.has(`${a}|${b}`)) continue;
      const { verdict, reason } = classifyPair(sorted[i], sorted[j]);
      if (verdict === "auto") result.auto.push([sorted[i], sorted[j]]);
      if (verdict === "review") result.review.push({ a, b, reason });
    }
  }
  return result;
}

async function queueForReview(pairs: ClassifiedPairs["review"], clusteredIds: Set<string>): Promise<number> {
  const fresh = pairs.filter((p) => !clusteredIds.has(p.a) || !clusteredIds.has(p.b));
  if (fresh.length === 0) return 0;
  const inserted = await db
    .insert(festivalDuplicateCandidates)
    .values(fresh.map((p) => ({ festivalA: p.a, festivalB: p.b, reason: p.reason })))
    .onConflictDoNothing()
    .returning({ a: festivalDuplicateCandidates.festivalA });
  return inserted.length;
}

/** Give the merged festival the cleanest member name, unless another row already holds it for that date. */
async function applyCleanestName(winnerId: string, cluster: DedupeRow[]): Promise<boolean> {
  const [merged] = await db.select({ name: festivals.name, date: festivals.date }).from(festivals).where(eq(festivals.id, winnerId)).limit(1);
  if (!merged) return false;
  const cleanest = pickCleanestName(merged.name, cluster.map((r) => r.name));
  if (cleanest === merged.name) return false;
  if (await findExistingFestivalByNameDate(cleanest, merged.date)) return false;
  await db.update(festivals).set({ name: cleanest }).where(eq(festivals.id, winnerId));
  return true;
}

export async function runDedupe(opts: DedupeOptions = {}): Promise<DedupeSummary> {
  const log = opts.log ?? (() => {});
  const maxMerges = opts.maxMerges ?? DEFAULT_MAX_MERGES;
  const abortAbove = opts.abortAboveClusters ?? DEFAULT_ABORT_ABOVE_CLUSTERS;

  const rows = await loadRows();
  const pairs = classifyAllPairs(rows, await loadDismissedPairs());
  const { clusters, oversized } = groupIntoClusters(pairs.auto);
  const summary: DedupeSummary = {
    festivals: rows.length, clusters: clusters.length, merged: 0, rowsAbsorbed: 0, renamed: 0,
    reviewQueued: 0, oversizedClusters: oversized.length, aborted: false, errors: [],
  };

  for (const cluster of oversized) {
    summary.errors.push(`oversized cluster left alone: ${cluster.map((r) => r.id).join(", ")}`);
  }
  const clusteredIds = new Set(clusters.flatMap((c) => c.members.map((r) => r.id)));
  if (!opts.dryRun) summary.reviewQueued = await queueForReview(pairs.review, clusteredIds);
  else summary.reviewQueued = pairs.review.length;
  for (const p of pairs.review) log(`  REVIEW: ${p.a} ~ ${p.b} (${p.reason})`);

  if (clusters.length > abortAbove) {
    summary.aborted = true;
    summary.errors.push(`${clusters.length} clusters found (limit ${abortAbove}) — merged nothing; run the script with --dry-run and review.`);
  }

  for (const { members, reasons } of clusters) {
    const winner = pickWinner(members);
    const loserIds = members.filter((r) => r.id !== winner.id).map((r) => r.id);
    log(`  MERGE: ${members.map((r) => `${r.id} "${r.name}" (${r.date}, artists=${r.artistIds.size}, slots=${r.slotCount})`).join("\n       + ")}\n    -> winner ${winner.id} [${reasons.join("; ")}]`);
    if (opts.dryRun || summary.aborted || summary.merged >= maxMerges) continue;
    try {
      const result = await mergeFestivalsCore(winner.id, loserIds);
      summary.merged++;
      summary.rowsAbsorbed += result.mergedLoserIds.length;
      if (await applyCleanestName(winner.id, members)) summary.renamed++;
      opts.onMerged?.(winner.id, result.mergedLoserIds);
    } catch (err) {
      summary.errors.push(`${winner.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
