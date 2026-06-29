/**
 * Daily Partyflock agenda import: scrape the curated rave agenda page and import
 * every event dated within the next week. Reuses the single-event import core
 * (`importPFEvent`, no auth/rate-limit) and adds inter-request delays + backoff
 * so a batch run stays gentle on partyflock.nl. Not a server action — invoked by
 * the cron route and the manual backfill script.
 */

import { fetchPFAgendaHtml, resolvePFEventSlug } from "@/services/partyflock/client";
import { parsePFAgendaResults, type PFAgendaEntry } from "@/services/partyflock/agenda-parser";
import { importPFEvent } from "./festival-import-pf";
import { checkExistingLineup } from "./festival-helpers";
import { sleep, withRetry } from "@/lib/retry";
import {
  PF_AGENDA_DAYS_AHEAD,
  PF_AGENDA_REQUEST_DELAY_MS,
  PF_AGENDA_MAX_RETRIES,
  PF_AGENDA_BACKOFF_BASE_MS,
} from "@/lib/constants";

const RETRY = { retries: PF_AGENDA_MAX_RETRIES, baseDelayMs: PF_AGENDA_BACKOFF_BASE_MS };
const EVENT_PREFIX = "event-";

export interface AgendaImportSummary {
  /** Unique events inside the date window. */
  found: number;
  /** Freshly imported from partyflock. */
  imported: number;
  /** Already in the DB — skipped without re-fetching the event page. */
  alreadyPresent: number;
  failed: number;
  /** Not attempted because the time budget ran out. */
  skipped: number;
  errors: string[];
}

export interface ImportPFAgendaOptions {
  daysAhead?: number;
  now?: Date;
  /** Wall-clock budget (ms). Stop starting new work once exceeded. */
  deadlineMs?: number;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function dedupeByPfId(entries: PFAgendaEntry[]): PFAgendaEntry[] {
  const seen = new Set<string>();
  const unique: PFAgendaEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.pfId)) continue;
    seen.add(entry.pfId);
    unique.push(entry);
  }
  return unique;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Resolve an entry to a numeric party id, following `/event/{slug}` series links. */
async function resolveNumericId(entry: PFAgendaEntry): Promise<string | null> {
  if (!entry.pfId.startsWith(EVENT_PREFIX)) return entry.pfId;
  const slug = entry.pfId.slice(EVENT_PREFIX.length);
  return withRetry(async () => {
    const id = await resolvePFEventSlug(slug);
    if (!id) throw new Error("slug did not resolve");
    return id;
  }, RETRY).catch(() => null);
}

async function importOne(numericId: string): Promise<void> {
  await withRetry(async () => {
    const result = await importPFEvent(numericId);
    if (!result) throw new Error("import returned null");
    return result;
  }, RETRY);
}

/**
 * Scrape the Partyflock agenda and import every event dated within the next
 * `daysAhead` days. Honors an optional wall-clock budget so callers with a
 * function timeout (e.g. a cron route) stop cleanly and resume on the next run;
 * imports are idempotent so partial progress is never lost.
 */
export async function importPFAgenda(
  opts: ImportPFAgendaOptions = {}
): Promise<AgendaImportSummary> {
  const startedAt = Date.now();
  const daysAhead = opts.daysAhead ?? PF_AGENDA_DAYS_AHEAD;
  const windowStart = toIsoDate(opts.now ?? new Date());
  const windowEnd = addDays(windowStart, daysAhead);

  const html = await withRetry(async () => {
    const page = await fetchPFAgendaHtml();
    if (!page) throw new Error("agenda fetch returned empty");
    return page;
  }, RETRY);

  const inWindow = parsePFAgendaResults(html).filter(
    (entry) => entry.date >= windowStart && entry.date <= windowEnd
  );
  const unique = dedupeByPfId(inWindow);

  const summary: AgendaImportSummary = {
    found: unique.length,
    imported: 0,
    alreadyPresent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < unique.length; i++) {
    if (opts.deadlineMs !== undefined && Date.now() - startedAt > opts.deadlineMs) {
      summary.skipped = unique.length - i;
      break;
    }

    const entry = unique[i];
    const usedNetworkToResolve = entry.pfId.startsWith(EVENT_PREFIX);
    const numericId = await resolveNumericId(entry);

    if (!numericId) {
      summary.failed++;
      summary.errors.push(`${entry.name} (${entry.pfId}): could not resolve party id`);
      if (usedNetworkToResolve) await sleep(PF_AGENDA_REQUEST_DELAY_MS);
      continue;
    }

    if (await checkExistingLineup(`pf-${numericId}`)) {
      summary.alreadyPresent++;
      if (usedNetworkToResolve) await sleep(PF_AGENDA_REQUEST_DELAY_MS);
      continue;
    }

    try {
      await importOne(numericId);
      summary.imported++;
    } catch (err) {
      summary.failed++;
      summary.errors.push(`${entry.name} (${numericId}): ${errorMessage(err)}`);
    }
    await sleep(PF_AGENDA_REQUEST_DELAY_MS);
  }

  return summary;
}
