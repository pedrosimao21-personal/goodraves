/**
 * Daily timetable refresh for festivals happening soon. Partyflock usually
 * publishes (and keeps adjusting) timetables in the last days before an
 * event, so every festival within TIMETABLE_REFRESH_DAYS_AHEAD that has a
 * Partyflock source is re-checked every day — not just at fixed checkpoints.
 *
 * A festival's Partyflock sources are: its own id (`pf-<id>`), its linked
 * `pfPartyId` (RA/FestivalFans festivals linked for their timetable), and
 * any `pf-<id>` festival that was merged into it (festival_merges). Each
 * source is synced into the day it belongs to (`slot_date`), so a merged
 * multi-day festival keeps every day's timetable.
 *
 * Only a successfully fetched, non-empty timetable dated inside the
 * festival's own date range is ever applied — see syncTimetableDay. Not a
 * server action — invoked by the daily-maintenance cron.
 */

import { db } from "@/db";
import { and, gte, lte, or, isNotNull, like, sql, inArray } from "drizzle-orm";
import { festivals, festivalMerges } from "@/db/schema";
import { fetchPFEventHtml } from "@/services/partyflock/client";
import { parsePFEventPage } from "@/services/partyflock/parser";
import { syncTimetableDay, type TimetableSyncStatus } from "./festival-timetable-sync";
import { sleep } from "@/lib/retry";
import { toIsoDate, addDays } from "@/lib/dates";
import { PF_AGENDA_REQUEST_DELAY_MS, TIMETABLE_REFRESH_DAYS_AHEAD } from "@/lib/constants";

const PF_ID_PREFIX = "pf-";
const NUMERIC_ID = /^\d+$/;

export interface TimetableRefreshSummary {
  festivals: number;
  sources: number;
  updated: number;
  unchanged: number;
  noTimetable: number;
  dateMismatch: number;
  skippedShrink: number;
  failed: number;
  /** Sources not attempted because the time budget ran out. */
  skipped: number;
  errors: string[];
}

export interface TimetableRefreshOptions {
  now?: Date;
  /** Fetch and compare, but write nothing. */
  dryRun?: boolean;
  log?: (line: string) => void;
  deadlineMs?: number;
  /** Called once per festival whose stored timetable changed (e.g. to revalidate its cache). */
  onChanged?: (festivalId: string) => void;
}

type UpcomingFestival = { id: string; date: string; endDate: string | null; pfPartyId: string | null };
type Source = { festival: UpcomingFestival; partyId: string };

function partyIdFromFestivalId(id: string): string | null {
  if (!id.startsWith(PF_ID_PREFIX)) return null;
  const partyId = id.slice(PF_ID_PREFIX.length);
  return NUMERIC_ID.test(partyId) ? partyId : null;
}

async function loadUpcomingWithPFSources(today: string): Promise<UpcomingFestival[]> {
  const horizon = addDays(today, TIMETABLE_REFRESH_DAYS_AHEAD);
  return db
    .select({ id: festivals.id, date: festivals.date, endDate: festivals.endDate, pfPartyId: festivals.pfPartyId })
    .from(festivals)
    .where(
      and(
        lte(festivals.date, horizon),
        gte(sql`coalesce(${festivals.endDate}, ${festivals.date})`, today),
        or(
          like(festivals.id, `${PF_ID_PREFIX}%`),
          isNotNull(festivals.pfPartyId),
          inArray(
            festivals.id,
            db.select({ id: festivalMerges.winnerId }).from(festivalMerges).where(like(festivalMerges.loserId, `${PF_ID_PREFIX}%`))
          )
        )
      )
    );
}

async function collectSources(upcoming: UpcomingFestival[]): Promise<Source[]> {
  if (upcoming.length === 0) return [];
  const merged = await db
    .select({ loserId: festivalMerges.loserId, winnerId: festivalMerges.winnerId })
    .from(festivalMerges)
    .where(inArray(festivalMerges.winnerId, upcoming.map((f) => f.id)));

  const sources: Source[] = [];
  for (const festival of upcoming) {
    const partyIds = new Set<string>();
    const own = partyIdFromFestivalId(festival.id);
    if (own) partyIds.add(own);
    if (festival.pfPartyId && NUMERIC_ID.test(festival.pfPartyId)) partyIds.add(festival.pfPartyId);
    for (const m of merged) {
      const loserParty = m.winnerId === festival.id ? partyIdFromFestivalId(m.loserId) : null;
      if (loserParty) partyIds.add(loserParty);
    }
    for (const partyId of partyIds) sources.push({ festival, partyId });
  }
  return sources;
}

type SourceOutcome = TimetableSyncStatus | "noTimetable" | "dateMismatch" | "failed";

async function refreshSource({ festival, partyId }: Source, opts: TimetableRefreshOptions): Promise<SourceOutcome> {
  const html = await fetchPFEventHtml(partyId);
  if (!html) return "failed";

  const parsed = parsePFEventPage(html);
  if (!parsed.date) return "failed";
  // A Partyflock page can resolve to a different edition than the one we
  // store — only apply a timetable dated inside this festival's own range.
  if (parsed.date < festival.date || parsed.date > (festival.endDate ?? festival.date)) return "dateMismatch";
  if (parsed.timetable.length === 0) return "noTimetable";

  const result = await syncTimetableDay(festival.id, parsed.date, parsed.timetable, { dryRun: opts.dryRun });
  if (result.status !== "unchanged") {
    opts.log?.(`  ${result.status}: ${festival.id} (pf ${partyId}, ${parsed.date}) +${result.added} / -${result.removed} slots`);
  }
  return result.status;
}

function tally(summary: TimetableRefreshSummary, outcome: SourceOutcome): void {
  if (outcome === "updated") summary.updated++;
  else if (outcome === "unchanged") summary.unchanged++;
  else if (outcome === "skipped-shrink") summary.skippedShrink++;
  else if (outcome === "noTimetable") summary.noTimetable++;
  else if (outcome === "dateMismatch") summary.dateMismatch++;
  else summary.failed++;
}

/**
 * Re-sync the timetable of every upcoming festival that has a Partyflock
 * source. Honors an optional wall-clock budget; every step is idempotent,
 * so a run cut short simply continues on the next day.
 */
export async function refreshUpcomingTimetables(
  opts: TimetableRefreshOptions = {}
): Promise<TimetableRefreshSummary> {
  const startedAt = Date.now();
  const today = toIsoDate(opts.now ?? new Date());
  const upcoming = await loadUpcomingWithPFSources(today);
  const sources = await collectSources(upcoming);

  const summary: TimetableRefreshSummary = {
    festivals: upcoming.length,
    sources: sources.length,
    updated: 0,
    unchanged: 0,
    noTimetable: 0,
    dateMismatch: 0,
    skippedShrink: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < sources.length; i++) {
    if (opts.deadlineMs !== undefined && Date.now() - startedAt > opts.deadlineMs) {
      summary.skipped = sources.length - i;
      break;
    }
    const source = sources[i];
    try {
      const outcome = await refreshSource(source, opts);
      tally(summary, outcome);
      if (outcome === "updated") opts.onChanged?.(source.festival.id);
      if (outcome === "skipped-shrink") summary.errors.push(`${source.festival.id} (pf ${source.partyId}): fresh timetable much smaller than stored one — left untouched`);
    } catch (err) {
      summary.failed++;
      summary.errors.push(`${source.festival.id} (pf ${source.partyId}): ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(PF_AGENDA_REQUEST_DELAY_MS);
  }

  return summary;
}
