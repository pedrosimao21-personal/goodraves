import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { runDedupe } from "@/db/actions/festival-dedupe-core";
import { refreshUpcomingTimetables } from "@/db/actions/festival-timetable-refresh";
import { autoLinkPFTimetables } from "@/db/actions/festival-timetable-autolink";
import { timetableCacheTag } from "@/db/actions/festival-helpers";
import { recordCronRun } from "@/db/actions/cron-runs-core";
import { pruneRateLimitCounters } from "@/db/rate-limit";
import { pruneAuthTokens } from "@/db/auth-tokens";
import { pruneNotificationSends } from "@/db/notification-sends";
import { runNotificationStep } from "@/db/actions/notification-send-core";
import { SITE_URL } from "@/lib/site";
import { runArtistPhotoBackfill } from "@/db/actions/artist-photo-core";
import { verifySpotifyLinks } from "@/db/actions/spotify-verify-core";
import { isValidCronBearer } from "@/lib/cron-auth";
import { toIsoDate, addDays } from "@/lib/dates";
import {
  PF_AUTOLINK_DAYS_AHEAD,
  PF_AUTOLINK_RECHECK_DAYS,
  NOTIFICATION_STEP_BUDGET_MS,
  RA_PHOTOS_PER_DAILY_RUN,
  SPOTIFY_VERIFY_PER_DAILY_RUN,
} from "@/lib/constants";

// Hits partyflock.nl many times with delays; must run as a Node function,
// never be statically cached, and have a long execution budget. 300s is also
// the Vercel Hobby plan's maximum (with Fluid compute, the default).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Stop starting new work with headroom under maxDuration so the function
// returns its summary instead of being killed mid-request.
const DEADLINE_MS = 270_000;

// The artist-data steps run last; the timetable steps stop this much earlier so
// they can never starve them of time.
const ARTIST_STEPS_RESERVE_MS = 110_000;
const ARTIST_PHOTOS_BUDGET_MS = 60_000;

function remaining(startedAt: number, reserveMs = 0): number {
  return Math.max(0, DEADLINE_MS - reserveMs - (Date.now() - startedAt));
}

function revalidateFestival(festivalId: string): void {
  revalidateTag(timetableCacheTag(festivalId));
  revalidatePath(`/festival/${festivalId}`);
}

/**
 * Daily maintenance cron (see vercel.json — scheduled after the 04:00
 * Partyflock import, with room for Hobby's ±59 min trigger window). After a
 * quick prune of old rate-limit rows (they hold IP addresses), these steps
 * share one time budget, each idempotent so a run cut short simply continues
 * the next day:
 *   1. Dedupe — merge confidently-duplicate festivals, queue uncertain pairs
 *      for /admin/duplicates (DB-only, fast, so it runs first).
 *   2. Timetable refresh — re-sync Partyflock timetables of festivals in the
 *      next two weeks.
 *   3. Timetable auto-link — find a Partyflock timetable for upcoming
 *      festivals that don't have one yet.
 *   4. Artist photos — look the next artists up on Resident Advisor for a
 *      curated profile photo (artist-photo-core.ts).
 *   5. Notifications — the opt-in reminder and monthly-recap emails that are due
 *      (notification-send-core.ts), within the email provider's daily limit.
 *   6. Spotify links — re-verify a few stored Spotify matches against the
 *      artist's name, healing wrong ones (spotify-verify-core.ts).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!isValidCronBearer(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Links in notification emails point at the real site; locally, at the dev server being tested.
  const origin = process.env.NODE_ENV === "production" ? SITE_URL : new URL(request.url).origin;
  const summary = await recordCronRun("daily-maintenance", () => runMaintenance(origin));
  return NextResponse.json(summary);
}

/** A failed prune is reported in the run summary but never blocks the steps after it. Also clears spent emailed-link tokens and old send records. */
async function runRateLimitPrune(): Promise<{ removed: number; errors: string[] }> {
  try {
    const removed = (await pruneRateLimitCounters()) + (await pruneAuthTokens()) + (await pruneNotificationSends());
    return { removed, errors: [] };
  } catch (err) {
    return { removed: 0, errors: [err instanceof Error ? err.message : String(err)] };
  }
}

/** RA profile photos for the next artists in line. A failure is reported, never blocks the next step. */
async function runArtistPhotosStep(deadlineMs: number) {
  try {
    const summary = await runArtistPhotoBackfill({ limit: RA_PHOTOS_PER_DAILY_RUN, deadlineMs });
    return { ...summary, errors: summary.errors > 0 ? [`${summary.errors} RA lookups failed`] : [] };
  } catch (err) {
    return { errors: [err instanceof Error ? err.message : String(err)] };
  }
}

/** Opt-in reminder and recap emails. A failure is reported, never blocks the next step. */
async function runNotificationsStep(origin: string, deadlineMs: number) {
  try {
    return await runNotificationStep({ now: new Date(), origin, deadlineMs });
  } catch (err) {
    return { sent: 0, skipped: 0, errors: [err instanceof Error ? err.message : String(err)] };
  }
}

/** Re-verifies a few stored Spotify matches per day (upcoming lineups first); a spent Spotify quota ends it quietly. */
async function runSpotifyVerifyStep(deadlineMs: number) {
  try {
    const summary = await verifySpotifyLinks({ limit: SPOTIFY_VERIFY_PER_DAILY_RUN, deadlineMs });
    return { ...summary, aborted: summary.abortedBecause !== null, errors: summary.abortedBecause ? [summary.abortedBecause] : [] };
  } catch (err) {
    return { errors: [err instanceof Error ? err.message : String(err)] };
  }
}

async function runMaintenance(origin: string) {
  const startedAt = Date.now();
  const rateLimitPrune = await runRateLimitPrune();
  const dedupe = await runDedupe({
    onMerged: (winnerId, loserIds) => {
      revalidateFestival(winnerId);
      for (const loserId of loserIds) revalidatePath(`/festival/${loserId}`);
    },
  });

  const timetables = await refreshUpcomingTimetables({
    deadlineMs: remaining(startedAt, ARTIST_STEPS_RESERVE_MS),
    onChanged: revalidateFestival,
  });

  const today = toIsoDate(new Date());
  const autoLink = await autoLinkPFTimetables({
    fromDate: today,
    toDate: addDays(today, PF_AUTOLINK_DAYS_AHEAD),
    recheckDays: PF_AUTOLINK_RECHECK_DAYS,
    deadlineMs: remaining(startedAt, ARTIST_STEPS_RESERVE_MS),
    onLinked: revalidateFestival,
  });

  const artistPhotos = await runArtistPhotosStep(Math.min(remaining(startedAt), ARTIST_PHOTOS_BUDGET_MS));
  const notifications = await runNotificationsStep(origin, Math.min(remaining(startedAt), NOTIFICATION_STEP_BUDGET_MS));
  const spotifyLinks = await runSpotifyVerifyStep(remaining(startedAt));

  return { rateLimitPrune, dedupe, timetables, autoLink, artistPhotos, notifications, spotifyLinks };
}
