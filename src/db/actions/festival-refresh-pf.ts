/**
 * Scheduled Partyflock refresh: re-fetch festivals that are approaching, so
 * late-changing data (especially timetables, which are usually uploaded only
 * days before the event) makes it into the DB. For every imported Partyflock
 * festival whose date lands on a `PF_REFRESH_CHECKPOINT_DAYS` checkpoint
 * (7 and 2 days out), re-fetch the event and replace our stored copy via
 * `refreshPFEvent`. Reuses the agenda import's inter-request delays + backoff so
 * a batch run stays gentle on partyflock.nl. Not a server action — invoked by
 * the cron route and the manual script.
 */

import { db } from "@/db";
import { inArray, and, eq } from "drizzle-orm";
import { festivals } from "@/db/schema";
import { refreshPFEvent } from "./festival-import-pf";
import { sleep, withRetry } from "@/lib/retry";
import { toIsoDate, addDays } from "@/lib/dates";
import {
  PF_REFRESH_CHECKPOINT_DAYS,
  PF_AGENDA_REQUEST_DELAY_MS,
  PF_AGENDA_MAX_RETRIES,
  PF_AGENDA_BACKOFF_BASE_MS,
} from "@/lib/constants";

const RETRY = { retries: PF_AGENDA_MAX_RETRIES, baseDelayMs: PF_AGENDA_BACKOFF_BASE_MS };
const PF_ID_PREFIX = "pf-";

export interface RefreshSummary {
  /** Partyflock festivals whose date hit a checkpoint. */
  due: number;
  /** Successfully re-fetched and replaced. */
  refreshed: number;
  failed: number;
  /** Not attempted because the time budget ran out. */
  skipped: number;
  errors: string[];
}

export interface RefreshPFOptions {
  now?: Date;
  /** Wall-clock budget (ms). Stop starting new work once exceeded. */
  deadlineMs?: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Numeric party id from a `pf-<id>` festival id, or null if it isn't a plain numeric PF id. */
function toPartyId(festivalId: string): string | null {
  if (!festivalId.startsWith(PF_ID_PREFIX)) return null;
  const id = festivalId.slice(PF_ID_PREFIX.length);
  return /^\d+$/.test(id) ? id : null;
}

/**
 * Refresh every imported Partyflock festival sitting on a checkpoint date.
 * Honors an optional wall-clock budget so a cron caller stops cleanly and
 * resumes on the next run; refreshes are idempotent so partial progress is safe.
 */
export async function refreshDuePFFestivals(
  opts: RefreshPFOptions = {}
): Promise<RefreshSummary> {
  const startedAt = Date.now();
  const today = toIsoDate(opts.now ?? new Date());
  const checkpointDates = PF_REFRESH_CHECKPOINT_DAYS.map((days) => addDays(today, days));

  const dueFestivals = await db
    .select({ id: festivals.id })
    .from(festivals)
    .where(and(eq(festivals.source, "partyflock"), inArray(festivals.date, checkpointDates)));

  const summary: RefreshSummary = {
    due: dueFestivals.length,
    refreshed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < dueFestivals.length; i++) {
    if (opts.deadlineMs !== undefined && Date.now() - startedAt > opts.deadlineMs) {
      summary.skipped = dueFestivals.length - i;
      break;
    }

    const festivalId = dueFestivals[i].id;
    const partyId = toPartyId(festivalId);
    if (!partyId) {
      summary.failed++;
      summary.errors.push(`${festivalId}: not a numeric Partyflock id`);
      continue;
    }

    try {
      await withRetry(async () => {
        const result = await refreshPFEvent(partyId);
        if (!result) throw new Error("refresh returned null");
        return result;
      }, RETRY);
      summary.refreshed++;
    } catch (err) {
      summary.failed++;
      summary.errors.push(`${festivalId}: ${errorMessage(err)}`);
    }
    await sleep(PF_AGENDA_REQUEST_DELAY_MS);
  }

  return summary;
}
