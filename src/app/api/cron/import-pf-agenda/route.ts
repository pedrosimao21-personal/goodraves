import { NextResponse } from "next/server";
import { importPFAgenda } from "@/db/actions/festival-import-pf-agenda";

// This batch hits partyflock.nl many times with delays; it must run as a Node
// function, never be statically cached, and have a long execution budget.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // seconds (requires Vercel Pro / Fluid compute)

// Stop starting new imports with headroom under maxDuration so the function
// returns its summary instead of being killed mid-request.
const IMPORT_DEADLINE_MS = 270_000;

/**
 * Daily Partyflock agenda import. Triggered by Vercel Cron (see vercel.json),
 * which sends `Authorization: Bearer ${CRON_SECRET}`. Idempotent: a run cut off
 * by the time budget resumes on the next invocation.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await importPFAgenda({ deadlineMs: IMPORT_DEADLINE_MS });
  return NextResponse.json(summary);
}
