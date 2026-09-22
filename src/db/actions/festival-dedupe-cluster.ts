/**
 * Clustering + winner selection for the daily dedupe (festival-dedupe-core.ts).
 * Pure functions, no DB access and no "use server".
 */

import { classifyPair, type MatchRow } from "@/lib/festival-match";

export type DedupeRow = MatchRow & {
  source: string | null;
  slotCount: number;
  attendeeCount: number;
  updatedAt: string;
};

export type Cluster = { members: DedupeRow[]; reasons: string[] };

/** A cluster bigger or longer than this is more likely a chain of lookalikes than one event. */
const MAX_CLUSTER_SIZE = 8;
const MAX_CLUSTER_SPAN_DAYS = 10;
const MS_PER_DAY = 86_400_000;
const SOURCE_PRIORITY: Record<string, number> = { festivalfans: 3, partyflock: 2, ra: 1 };

/** Signs of a scraped listing title rather than the festival's own name. */
const JUNK_NAME_PATTERNS = [/:/, /\swith\s/i, /\sw\//i, /promo|discount|code/i, /\s[-–—|]\s/];

function spanDays(members: DedupeRow[]): number {
  const starts = members.map((r) => new Date(`${r.date}T00:00:00Z`).getTime());
  const ends = members.map((r) => new Date(`${r.endDate ?? r.date}T00:00:00Z`).getTime());
  return Math.round((Math.max(...ends) - Math.min(...starts)) / MS_PER_DAY);
}

/**
 * Union-find over the auto-merge pairs. Pairs chain transitively (day 1 ~
 * day 2 ~ day 3 of one festival are one cluster even though day 1 and day 3
 * are two days apart), which is what per-day rows need — but a long chain of
 * lookalikes could also glue unrelated events together. So each finished
 * cluster is sanity-checked on size and total date span, and oversized ones
 * are returned separately and never merged.
 */
export function groupIntoClusters(pairs: [MatchRow, MatchRow][]): { clusters: Cluster[]; oversized: DedupeRow[][] } {
  const parent = new Map<string, string>();
  const rowById = new Map<string, DedupeRow>();
  const reasonsByRoot = new Map<string, string[]>();
  const find = (id: string): string => {
    let cur = id;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    return cur;
  };

  for (const [a, b] of pairs) {
    for (const r of [a, b]) {
      if (!parent.has(r.id)) parent.set(r.id, r.id);
      rowById.set(r.id, r as DedupeRow);
    }
    parent.set(find(a.id), find(b.id));
  }

  const membersByRoot = new Map<string, DedupeRow[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    membersByRoot.set(root, [...(membersByRoot.get(root) ?? []), rowById.get(id)!]);
  }
  for (const [a, b] of pairs) {
    const root = find(a.id);
    reasonsByRoot.set(root, [...new Set([...(reasonsByRoot.get(root) ?? []), classifyPair(a, b).reason])]);
  }

  const clusters: Cluster[] = [];
  const oversized: DedupeRow[][] = [];
  for (const [root, members] of membersByRoot) {
    const isTooBig = members.length > MAX_CLUSTER_SIZE || spanDays(members) > MAX_CLUSTER_SPAN_DAYS;
    if (isTooBig) oversized.push(members);
    else clusters.push({ members, reasons: reasonsByRoot.get(root) ?? [] });
  }
  return { clusters, oversized };
}

/**
 * Keep the row with the most data: most artists, then a timetable, then the
 * richer source, then the one users already track, then the most recently
 * updated. The merge itself copies everything else over from the losers.
 */
export function pickWinner(members: DedupeRow[]): DedupeRow {
  return [...members].sort((a, b) => {
    if (a.artistIds.size !== b.artistIds.size) return b.artistIds.size - a.artistIds.size;
    const slotsA = a.slotCount > 0 ? 1 : 0;
    const slotsB = b.slotCount > 0 ? 1 : 0;
    if (slotsA !== slotsB) return slotsB - slotsA;
    const prioA = SOURCE_PRIORITY[a.source ?? ""] ?? 0;
    const prioB = SOURCE_PRIORITY[b.source ?? ""] ?? 0;
    if (prioA !== prioB) return prioB - prioA;
    if (a.attendeeCount !== b.attendeeCount) return b.attendeeCount - a.attendeeCount;
    if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    return a.id.localeCompare(b.id);
  })[0];
}

function junkScore(name: string): number {
  const isAllCaps = name === name.toUpperCase() && /[A-Z]/.test(name);
  return JUNK_NAME_PATTERNS.filter((p) => p.test(name)).length + (isAllCaps ? 1 : 0);
}

/**
 * Only swaps a clearly scraped-looking name ("Watergate Open Air with Anfisa
 * Letyago, …") for a cleaner member name ("Watergate Open Air") — never
 * churns between two equally fine names.
 */
export function pickCleanestName(current: string, candidates: string[]): string {
  const best = [...candidates].sort((a, b) => junkScore(a) - junkScore(b) || a.length - b.length)[0];
  return best && junkScore(best) < junkScore(current) ? best : current;
}
