import { db } from "@/db";
import { desc, eq, gte, sql } from "drizzle-orm";
import { festivalDuplicateCandidates, festivalMerges, festivals } from "@/db/schema";
import { ADMIN_CRON_HISTORY_LIMIT, ADMIN_RECENT_DAYS } from "@/lib/constants";
import { CRON_JOBS, listRecentCronRuns, type CronRunRecord } from "./cron-runs-core";

/**
 * Deliberately no "use server" — reads behind the admin-checked /admin page,
 * its only caller.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CronJobHistory = (typeof CRON_JOBS)[number] & { runs: CronRunRecord[] };

export type SourceCount = { source: string; total: number; recent: number };

export type AdminDashboardData = {
  pendingDuplicates: number;
  jobs: CronJobHistory[];
  sources: SourceCount[];
  mergedRecently: number;
  recentDays: number;
  /** When this data was read; the page measures run ages against it. */
  now: Date;
};

async function countPendingDuplicates(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(festivalDuplicateCandidates)
    .where(eq(festivalDuplicateCandidates.status, "pending"));
  return row?.count ?? 0;
}

/** Festivals per source: all-time total, and how many were added since `since`. */
async function countFestivalsBySource(since: Date): Promise<SourceCount[]> {
  const total = sql<number>`count(*)`.mapWith(Number);
  const rows = await db
    .select({
      source: festivals.source,
      total,
      recent: sql<number>`count(*) filter (where ${festivals.createdAt} >= ${since.toISOString()}::timestamptz)`.mapWith(Number),
    })
    .from(festivals)
    .groupBy(festivals.source)
    .orderBy(desc(total));
  return rows.map((row) => ({ ...row, source: row.source ?? "unknown" }));
}

async function countMergesSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(festivalMerges)
    .where(gte(festivalMerges.mergedAt, since));
  return row?.count ?? 0;
}

async function loadJobHistories(): Promise<CronJobHistory[]> {
  return Promise.all(
    CRON_JOBS.map(async (job) => ({ ...job, runs: await listRecentCronRuns(job.id, ADMIN_CRON_HISTORY_LIMIT) })),
  );
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const now = new Date();
  const since = new Date(now.getTime() - ADMIN_RECENT_DAYS * MS_PER_DAY);
  const [pendingDuplicates, jobs, sources, mergedRecently] = await Promise.all([
    countPendingDuplicates(),
    loadJobHistories(),
    countFestivalsBySource(since),
    countMergesSince(since),
  ]);
  return { pendingDuplicates, jobs, sources, mergedRecently, recentDays: ADMIN_RECENT_DAYS, now };
}
