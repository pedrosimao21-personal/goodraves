import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { runDedupe } from "@/db/actions/festival-dedupe-core";
import { refreshUpcomingTimetables } from "@/db/actions/festival-timetable-refresh";
import { autoLinkPFTimetables } from "@/db/actions/festival-timetable-autolink";
import { timetableCacheTag } from "@/db/actions/festival-helpers";
import { recordCronRun } from "@/db/actions/cron-runs-core";
import { pruneRateLimitCounters } from "@/db/rate-limit";
import { isValidCronBearer } from "@/lib/cron-auth";
import { toIsoDate, addDays } from "@/lib/dates";
import { PF_AUTOLINK_DAYS_AHEAD, PF_AUTOLINK_RECHECK_DAYS } from "@/lib/constants";

// Hits partyflock.nl many times with delays; must run as a Node function,
// never be statically cached, and have a long execution budget. 300s is also
// the Vercel Hobby plan's maximum (with Fluid compute, the default).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Stop starting new work with headroom under maxDuration so the function
// returns its summary instead of being killed mid-request.
const DEADLINE_MS = 270_000;

function remaining(startedAt: number): number {
  return Math.max(0, DEADLINE_MS - (Date.now() - startedAt));
}

function revalidateFestival(festivalId: string): void {
  revalidateTag(timetableCacheTag(festivalId));
  revalidatePath(`/festival/${festivalId}`);
}

/**
 * Daily maintenance cron (see vercel.json — scheduled after the 04:00
 * Partyflock import, with room for Hobby's ±59 min trigger window). After a
 * quick prune of old rate-limit rows (they hold IP addresses), three steps
 * share one time budget, each idempotent so a run cut short simply continues
 * the next day:
 *   1. Dedupe — merge confidently-duplicate festivals, queue uncertain pairs
 *      for /admin/duplicates (DB-only, fast, so it runs first).
 *   2. Timetable refresh — re-sync Partyflock timetables of festivals in the
 *      next two weeks.
 *   3. Timetable auto-link — find a Partyflock timetable for upcoming
 *      festivals that don't have one yet.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!isValidCronBearer(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await recordCronRun("daily-maintenance", runMaintenance);
  return NextResponse.json(summary);
}

/** A failed prune is reported in the run summary but never blocks the steps after it. */
async function runRateLimitPrune(): Promise<{ removed: number; errors: string[] }> {
  try {
    return { removed: await pruneRateLimitCounters(), errors: [] };
  } catch (err) {
    return { removed: 0, errors: [err instanceof Error ? err.message : String(err)] };
  }
}

async function runMaintenance() {
  const startedAt = Date.now();
  const rateLimitPrune = await runRateLimitPrune();
  const dedupe = await runDedupe({
    onMerged: (winnerId, loserIds) => {
      revalidateFestival(winnerId);
      for (const loserId of loserIds) revalidatePath(`/festival/${loserId}`);
    },
  });

  const timetables = await refreshUpcomingTimetables({
    deadlineMs: remaining(startedAt),
    onChanged: revalidateFestival,
  });

  const today = toIsoDate(new Date());
  const autoLink = await autoLinkPFTimetables({
    fromDate: today,
    toDate: addDays(today, PF_AUTOLINK_DAYS_AHEAD),
    recheckDays: PF_AUTOLINK_RECHECK_DAYS,
    deadlineMs: remaining(startedAt),
    onLinked: revalidateFestival,
  });

  return { rateLimitPrune, dedupe, timetables, autoLink };
}
