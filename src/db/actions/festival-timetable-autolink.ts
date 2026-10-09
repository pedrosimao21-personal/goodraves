/**
 * Best-effort auto-linking of festivals that have no timetable to their
 * Partyflock page. Deliberately no "use server" — shared by the daily
 * maintenance cron (upcoming festivals only, rate-limited per festival via
 * `pf_link_checked_at`) and scripts/link-pf-timetables.ts (full backfill).
 *
 * An exact date match against the festival's stored date is a hard gate
 * before anything is even scored — Partyflock series/event pages can resolve
 * to whichever edition is "current", so date is the one signal that can't be
 * a false positive. Matches are then scored on normalized name + venue/city
 * similarity; only matches above the auto-link threshold are imported.
 * Lower-confidence matches are reported for manual review via the admin
 * "Link Partyflock Timetable" action on the festival page instead of being
 * guessed at.
 */

import { db } from "@/db";
import { and, eq, gte, lte, isNull, lt, or, ne, notInArray, asc } from "drizzle-orm";
import { festivals, festivalTimetableSlots } from "@/db/schema";
import { searchPFEventsRaw } from "@/services/partyflock/client";
import { parsePFSearchResults } from "@/services/partyflock/parser";
import { importPFTimetable } from "./festival-helpers";
import { sleep } from "@/lib/retry";
import { PF_AGENDA_REQUEST_DELAY_MS } from "@/lib/constants";

const NAME_SIM_AUTO_THRESHOLD = 0.6;
const NAME_SIM_REVIEW_THRESHOLD = 0.3;
const LOCATION_SIM_BONUS = 0.15;
const MS_PER_DAY = 86_400_000;

export interface AutoLinkOptions {
  dryRun?: boolean;
  /** Only festivals dated inside this ISO date window (inclusive). */
  fromDate?: string;
  toDate?: string;
  /** Skip festivals already searched within this many days (stamped via pf_link_checked_at). */
  recheckDays?: number;
  deadlineMs?: number;
  log?: (line: string) => void;
  onLinked?: (festivalId: string) => void;
}

export interface AutoLinkSummary {
  checked: number;
  linked: number;
  needsReview: number;
  noMatch: number;
  failed: number;
  skipped: number;
  errors: string[];
}

type Target = { id: string; name: string; date: string; venue: string | null; location: string | null };

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

async function loadTargets(opts: AutoLinkOptions): Promise<Target[]> {
  const conditions = [
    isNull(festivals.pfPartyId),
    or(isNull(festivals.source), ne(festivals.source, "partyflock"))!,
    notInArray(festivals.id, db.selectDistinct({ id: festivalTimetableSlots.festivalId }).from(festivalTimetableSlots)),
  ];
  if (opts.fromDate) conditions.push(gte(festivals.date, opts.fromDate));
  if (opts.toDate) conditions.push(lte(festivals.date, opts.toDate));
  if (opts.recheckDays !== undefined) {
    const cutoff = new Date(Date.now() - opts.recheckDays * MS_PER_DAY);
    conditions.push(or(isNull(festivals.pfLinkCheckedAt), lt(festivals.pfLinkCheckedAt, cutoff))!);
  }
  return db
    .select({ id: festivals.id, name: festivals.name, date: festivals.date, venue: festivals.venue, location: festivals.location })
    .from(festivals)
    .where(and(...conditions))
    .orderBy(asc(festivals.date));
}

type MatchOutcome = { kind: "noMatch" } | { kind: "review" | "match"; url: string; label: string };

async function findBestMatch(festival: Target): Promise<MatchOutcome> {
  const html = await searchPFEventsRaw(festival.name);
  if (!html) return { kind: "noMatch" };

  const dateMatches = parsePFSearchResults(html).filter((r) => r.date === festival.date);
  let best: { result: (typeof dateMatches)[number]; score: number } | null = null;
  for (const result of dateMatches) {
    // Score against the title alone too: an RA/FestivalFans name is often the
    // bare brand ("Awakenings") while the Partyflock name carries a subtitle.
    const score =
      Math.max(nameSimilarity(festival.name, result.name), nameSimilarity(festival.name, result.title)) +
      locationSimilarity(festival.venue ?? festival.location, result.venue ?? result.location);
    if (!best || score > best.score) best = { result, score };
  }
  if (!best || best.score < NAME_SIM_REVIEW_THRESHOLD) return { kind: "noMatch" };

  const url = buildPfUrl(best.result.pfId);
  const label = `"${festival.name}" (${festival.date}) ~ "${best.result.name}" score=${best.score.toFixed(2)} — ${url}`;
  return { kind: best.score < NAME_SIM_AUTO_THRESHOLD ? "review" : "match", url, label };
}

async function stampChecked(festivalId: string): Promise<void> {
  await db.update(festivals).set({ pfLinkCheckedAt: new Date() }).where(eq(festivals.id, festivalId));
}

async function linkOne(festival: Target, opts: AutoLinkOptions, summary: AutoLinkSummary): Promise<void> {
  const log = opts.log ?? (() => {});
  const outcome = await findBestMatch(festival);
  // Stamped whatever the outcome (incl. an import that fails below, e.g. a
  // Partyflock page with no timetable yet), so the cron re-searches this
  // festival only every `recheckDays` instead of on every run.
  if (!opts.dryRun) await stampChecked(festival.id);
  if (outcome.kind === "noMatch") summary.noMatch++;
  if (outcome.kind === "review") {
    log(`  REVIEW: ${outcome.label}`);
    summary.needsReview++;
  }
  if (outcome.kind === "match") {
    log(`  MATCH: ${outcome.label}`);
    if (opts.dryRun) {
      summary.linked++;
      return;
    }
    const result = await importPFTimetable(festival.id, outcome.url);
    log(`    imported ${result.slotCount} slot(s) across ${result.stageCount} stage(s) (${result.newArtistCount} new artist(s) added to the lineup)`);
    summary.linked++;
    opts.onLinked?.(festival.id);
  }
}

export async function autoLinkPFTimetables(opts: AutoLinkOptions = {}): Promise<AutoLinkSummary> {
  const startedAt = Date.now();
  const targets = await loadTargets(opts);
  const summary: AutoLinkSummary = { checked: 0, linked: 0, needsReview: 0, noMatch: 0, failed: 0, skipped: 0, errors: [] };
  opts.log?.(`${targets.length} festival(s) to check.\n`);

  for (let i = 0; i < targets.length; i++) {
    if (opts.deadlineMs !== undefined && Date.now() - startedAt > opts.deadlineMs) {
      summary.skipped = targets.length - i;
      break;
    }
    summary.checked++;
    try {
      await linkOne(targets[i], opts, summary);
    } catch (err) {
      summary.failed++;
      summary.errors.push(`${targets[i].id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(PF_AGENDA_REQUEST_DELAY_MS);
  }

  return summary;
}
