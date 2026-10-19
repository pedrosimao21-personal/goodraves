import { db } from "@/db";
import { desc, eq, lt, sql } from "drizzle-orm";
import { cronRuns } from "@/db/schema";
import { CRON_RUN_RETENTION_DAYS } from "@/lib/constants";

/**
 * Deliberately no "use server" — run history for the cron routes in
 * src/app/api/cron/ (writers) and the admin-checked /admin page (reader).
 */

/** The Vercel Cron jobs (see vercel.json; schedules there are UTC). */
export const CRON_JOBS = [
  { id: "import-pf-agenda", label: "Partyflock import", schedule: "daily 04:00 UTC" },
  { id: "daily-maintenance", label: "Daily maintenance", schedule: "daily 06:00 UTC" },
] as const;

export type CronJobId = (typeof CRON_JOBS)[number]["id"];
export type CronRunStatus = "running" | "ok" | "partial" | "error";

/** One step's result inside a route summary (RefreshSummary, DedupeSummary, ...). */
type StepResult = { skipped?: number; errors?: string[]; aborted?: boolean };
export type CronSummary = Record<string, StepResult>;

export type CronRunRecord = {
  id: string;
  job: string;
  status: CronRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  summary: CronSummary | null;
  error: string | null;
};

function isStepIncomplete(step: StepResult): boolean {
  return (step.skipped ?? 0) > 0 || (step.errors?.length ?? 0) > 0 || step.aborted === true;
}

/** "partial" when any step ran out of time budget, hit errors, or aborted. */
export function deriveCronStatus(summary: CronSummary): CronRunStatus {
  return Object.values(summary).some(isStepIncomplete) ? "partial" : "ok";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function pruneOldRuns(): Promise<void> {
  await db
    .delete(cronRuns)
    .where(lt(cronRuns.startedAt, sql`now() - interval '1 day' * ${CRON_RUN_RETENTION_DAYS}`));
}

async function finishRun(id: string, status: CronRunStatus, summary: CronSummary | null, error: string | null): Promise<void> {
  await db
    .update(cronRuns)
    .set({ status, finishedAt: new Date(), summary: summary ? JSON.stringify(summary) : null, error })
    .where(eq(cronRuns.id, id));
}

/**
 * Run a cron job body and record it in cron_runs. The row is inserted before
 * the job starts, so a run Vercel kills at maxDuration still shows up (with no
 * finishedAt). A thrown job error is recorded, then rethrown so the route
 * still fails visibly in Vercel's logs.
 */
export async function recordCronRun<T extends CronSummary>(job: CronJobId, run: () => Promise<T>): Promise<T> {
  await pruneOldRuns();
  const [row] = await db.insert(cronRuns).values({ job }).returning({ id: cronRuns.id });

  let summary: T;
  try {
    summary = await run();
  } catch (err) {
    await finishRun(row.id, "error", null, errorMessage(err));
    throw err;
  }
  await finishRun(row.id, deriveCronStatus(summary), summary, null);
  return summary;
}

/** The latest `limit` runs of `job`, newest first. */
export async function listRecentCronRuns(job: CronJobId, limit: number): Promise<CronRunRecord[]> {
  const rows = await db
    .select()
    .from(cronRuns)
    .where(eq(cronRuns.job, job))
    .orderBy(desc(cronRuns.startedAt))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    status: row.status as CronRunStatus,
    summary: row.summary ? (JSON.parse(row.summary) as CronSummary) : null,
  }));
}
