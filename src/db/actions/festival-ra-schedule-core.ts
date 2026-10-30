import { db } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { festivals, festivalMerges } from "@/db/schema";
import { fetchRAEventRaw } from "@/services/ra/client";
import { deriveEventSchedule } from "@/lib/event-schedule";
import { toIsoDate } from "@/lib/dates";
import { sleep } from "@/lib/retry";
import { RA_SCHEDULE_REQUEST_DELAY_MS, RA_SCHEDULE_MAX_CONSECUTIVE_FAILURES, RA_SCHEDULE_RECHECK_STALE_MS } from "@/lib/constants";

/**
 * Re-reads an RA festival's days and clock times from Resident Advisor.
 *
 * RA events used to be stored with the calendar date of their end timestamp, so
 * a Saturday-night party ending at 04:00 looked like a two-day event. The days
 * now follow lib/event-schedule.ts ("a night belongs to the day it started"),
 * and the announced times are kept. The same pass fixes events RA has since
 * rescheduled, whose stored dates went stale. Used by
 * scripts/backfill-festival-schedules.ts and, for a festival still without
 * times, on its first page view.
 *
 * A date is only rewritten when that cannot collide with, or undo, other data:
 * the (name, date) pair stays unique, a festival other entries were merged into
 * keeps its dates (the merge may have widened them), and dates that look like RA
 * data errors are ignored. Times are always safe.
 */

export type ScheduleRow = {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  sourceId: string | null;
};

export type ScheduleOutcome =
  /** RA didn't return the event (gone, or RA is unwell): nothing changed. */
  | { status: "unavailable" }
  | { status: "unchanged" }
  | { status: "timesAdded" }
  | { status: "datesChanged"; from: string; to: string }
  /** The dates differ from RA's but were left alone (the reason); times were still saved. */
  | { status: "datesKept"; from: string; to: string; reason: KeepReason };

type KeepReason = "merged" | "duplicate" | "implausible";

// RA now and then reports nonsense (one event started two years before it ended).
// A real reschedule moves a festival by weeks or months, not years, and no festival lasts longer than this.
const MAX_PLAUSIBLE_SHIFT_DAYS = 365;
const MAX_PLAUSIBLE_LENGTH_DAYS = 14;
const MS_PER_DAY = 86_400_000;

const daysBetween = (a: string, b: string) => Math.abs(Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY;

function isImplausible(row: ScheduleRow, schedule: { date: string; endDate: string | null }): boolean {
  return daysBetween(row.date, schedule.date) > MAX_PLAUSIBLE_SHIFT_DAYS || daysBetween(schedule.date, schedule.endDate ?? schedule.date) > MAX_PLAUSIBLE_LENGTH_DAYS;
}

const formatDays = (date: string, endDate: string | null) => (endDate ? `${date}..${endDate}` : date);

async function isMergeWinner(id: string): Promise<boolean> {
  const [row] = await db.select({ id: festivalMerges.winnerId }).from(festivalMerges).where(eq(festivalMerges.winnerId, id)).limit(1);
  return Boolean(row);
}

async function nameDateTaken(row: ScheduleRow, date: string): Promise<boolean> {
  const [taken] = await db
    .select({ id: festivals.id })
    .from(festivals)
    .where(and(eq(festivals.name, row.name), eq(festivals.date, date), sql`${festivals.id} <> ${row.id}`))
    .limit(1);
  return Boolean(taken);
}

/** Fetches the festival's event from RA and saves its times, plus its days where that is safe. */
export async function applyRaSchedule(row: ScheduleRow, opts: { isDryRun?: boolean } = {}): Promise<ScheduleOutcome> {
  const raId = row.sourceId ?? row.id.replace(/^ra-/, "");
  const data = await fetchRAEventRaw(raId);
  const schedule = data ? deriveEventSchedule(data.startTime, data.endTime) : null;
  if (!schedule) return { status: "unavailable" };

  const from = formatDays(row.date, row.endDate);
  const to = formatDays(schedule.date, schedule.endDate);
  const isDifferent = schedule.date !== row.date || schedule.endDate !== row.endDate;

  let keepReason: KeepReason | null = null;
  if (isDifferent) {
    if (isImplausible(row, schedule)) keepReason = "implausible";
    else if (await isMergeWinner(row.id)) keepReason = "merged";
    else if (schedule.date !== row.date && (await nameDateTaken(row, schedule.date))) keepReason = "duplicate";
  }

  const changesDays = isDifferent && !keepReason;
  if (!opts.isDryRun) {
    await db
      .update(festivals)
      .set({
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        timesCheckedAt: new Date(),
        ...(changesDays ? { date: schedule.date, endDate: schedule.endDate } : {}),
      })
      .where(eq(festivals.id, row.id));
  }

  if (keepReason) return { status: "datesKept", from, to, reason: keepReason };
  if (changesDays) return { status: "datesChanged", from, to };
  return row.startTime ? { status: "unchanged" } : { status: "timesAdded" };
}

/** Records that RA was asked and had nothing, so the festival isn't asked about on every view. */
async function stampChecked(ids: string[]): Promise<void> {
  for (const id of ids) await db.update(festivals).set({ timesCheckedAt: new Date() }).where(eq(festivals.id, id));
}

/**
 * On-demand version for the festival page: an RA festival that still lacks
 * times. Stamps the attempt even when RA answers nothing, like the lineup and
 * image re-checks, and never throws into the page render. Returns the fresh
 * row, or null when nothing was due or it failed.
 */
export async function ensureRaSchedule(festival: typeof festivals.$inferSelect) {
  if (festival.source !== "ra" || festival.startTime) return null;
  const lastCheck = festival.timesCheckedAt?.getTime() ?? 0;
  if (Date.now() - lastCheck < RA_SCHEDULE_RECHECK_STALE_MS) return null;

  try {
    const outcome = await applyRaSchedule(festival);
    if (outcome.status === "unavailable") await stampChecked([festival.id]);
  } catch (error) {
    console.error(`[ra-schedule] could not refresh ${festival.id}:`, error);
    return null;
  }
  const [fresh] = await db.select().from(festivals).where(eq(festivals.id, festival.id)).limit(1);
  return fresh ?? null;
}

export type ScheduleBackfillSummary = {
  checked: number;
  datesChanged: number;
  datesKept: number;
  timesAdded: number;
  unchanged: number;
  unavailable: number;
  aborted: boolean;
};

async function selectScheduleCandidates(limit: number): Promise<ScheduleRow[]> {
  const today = toIsoDate(new Date());
  const staleBefore = new Date(Date.now() - RA_SCHEDULE_RECHECK_STALE_MS);
  const result = await db.execute(sql`
    SELECT id, name, date, end_date AS "endDate", start_time AS "startTime", end_time AS "endTime", source_id AS "sourceId"
    FROM festivals
    WHERE source = 'ra' AND start_time IS NULL
      AND (times_checked_at IS NULL OR times_checked_at < ${staleBefore.toISOString()})
    ORDER BY (coalesce(end_date, date) >= ${today}) DESC, date, id
    LIMIT ${limit}`);
  return result.rows as ScheduleRow[];
}

function describe(row: ScheduleRow, outcome: ScheduleOutcome): string {
  const label = `"${row.name}" (${row.id})`;
  switch (outcome.status) {
    case "datesChanged": return `DAYS:  ${label} ${outcome.from} -> ${outcome.to}`;
    case "datesKept": return `KEPT:  ${label} RA says ${outcome.to}, stored ${outcome.from} left as is (${outcome.reason})`;
    case "timesAdded": return `TIMES: ${label}`;
    case "unchanged": return `OK:    ${label}`;
    case "unavailable": return `GONE:  ${label} — RA returned nothing`;
  }
}

/** Works through RA festivals without times (lineups still to come first). Repeatable: each one it settles is stamped or filled. */
export async function runScheduleBackfill(opts: {
  limit: number;
  isDryRun?: boolean;
  deadlineMs?: number;
  log?: (line: string) => void;
}): Promise<ScheduleBackfillSummary> {
  const startedAt = Date.now();
  const log = opts.log ?? (() => undefined);
  const summary: ScheduleBackfillSummary = { checked: 0, datesChanged: 0, datesKept: 0, timesAdded: 0, unchanged: 0, unavailable: 0, aborted: false };
  // Events RA returned nothing for are only stamped once a later answer shows RA is healthy,
  // so an outage can't make a whole batch look "checked".
  let unanswered: string[] = [];

  for (const row of await selectScheduleCandidates(opts.limit)) {
    if (opts.deadlineMs !== undefined && Date.now() - startedAt > opts.deadlineMs) break;
    const outcome = await applyRaSchedule(row, { isDryRun: opts.isDryRun });
    summary.checked += 1;
    log(describe(row, outcome));

    if (outcome.status === "unavailable") {
      summary.unavailable += 1;
      unanswered.push(row.id);
      if (unanswered.length >= RA_SCHEDULE_MAX_CONSECUTIVE_FAILURES) { summary.aborted = true; break; }
    } else {
      summary[outcome.status] += 1;
      if (!opts.isDryRun) await stampChecked(unanswered);
      unanswered = [];
    }
    await sleep(RA_SCHEDULE_REQUEST_DELAY_MS);
  }
  return summary;
}
