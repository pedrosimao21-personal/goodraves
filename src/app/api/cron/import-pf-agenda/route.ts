import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { importPFAgenda } from "@/db/actions/festival-import-pf-agenda";
import { refreshDuePFFestivals } from "@/db/actions/festival-refresh-pf";

// rate_limit_counters buckets are only ever cleaned up for the specific
// identifier+action a caller just hit (see rate-limit.ts) — anyone who never
// comes back leaves their bucket rows behind forever. Sweep old ones here
// daily rather than adding a second cron just for this.
const RATE_LIMIT_COUNTER_MAX_AGE_HOURS = 24;

/** Constant-time comparison of the bearer token to avoid a timing side-channel. */
function isValidBearer(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// This batch hits partyflock.nl many times with delays; it must run as a Node
// function, never be statically cached, and have a long execution budget.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // seconds (requires Vercel Pro / Fluid compute)

// Stop starting new work with headroom under maxDuration so the function
// returns its summary instead of being killed mid-request.
const DEADLINE_MS = 270_000;

/**
 * Daily Partyflock cron. Triggered by Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer ${CRON_SECRET}`. Does two things, sharing one time budget:
 *   1. Refresh festivals at their 7-day / 2-day checkpoints (late timetables etc.).
 *   2. Import the agenda (next 6 months) for anything not yet in the DB.
 * Refresh runs first because it is time-sensitive; the import is larger but resumes
 * on the next run if the budget is exhausted. Both are idempotent.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (!isValidBearer(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const refresh = await refreshDuePFFestivals({ deadlineMs: DEADLINE_MS });
  const importDeadline = Math.max(0, DEADLINE_MS - (Date.now() - startedAt));
  const importSummary = await importPFAgenda({ deadlineMs: importDeadline });

  // Best-effort: every window's own per-key cleanup already keeps hot rows
  // trimmed (see rate-limit.ts) — this only matters for identifiers that
  // never come back, so a failure here shouldn't fail the whole cron run.
  await db
    .execute(sql`DELETE FROM rate_limit_counters WHERE window_start < now() - interval '1 hour' * ${RATE_LIMIT_COUNTER_MAX_AGE_HOURS}`)
    .catch((err) => console.error("[cron] rate_limit_counters cleanup failed:", err));

  return NextResponse.json({ refresh, import: importSummary });
}
