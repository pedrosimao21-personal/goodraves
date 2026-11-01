import { toIsoDate } from "@/lib/dates";
import { NOTIFICATION_DAILY_LIMIT, NOTIFICATION_SEND_GAP_MS } from "@/lib/constants";
import { createUnsubscribeToken } from "@/lib/unsubscribe-token";
import { sendEmail } from "@/services/email/client";
import { claimNotificationSend, countNotificationSendsToday, releaseNotificationSend } from "@/db/notification-sends";
import { collectNotificationJobs, type NotificationJob } from "./notification-jobs";

/**
 * Sends the due notification emails (reminders, monthly recaps) for the daily cron.
 * Each message is claimed in the ledger first, so a repeated run never mails it twice;
 * a failed send gives the claim back and is retried the next day. Plain server module
 * (not `"use server"`), like the rest of the cron cores.
 */

export type NotificationRunSummary = { sent: number; skipped: number; errors: string[]; aborted?: boolean };

const MAX_ERRORS_REPORTED = 3;
const RATE_LIMITED_STATUS = "429";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The headers that let a mail app offer its own "Unsubscribe" button (RFC 8058 one-click). */
function unsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

type DeliveryOutcome = "sent" | "already-claimed" | "stop" | "failed";

/** Claims and sends one job. "stop" means every further send would fail too (no email setup, provider rate limit). */
async function deliver(job: NotificationJob, origin: string, errors: string[]): Promise<DeliveryOutcome> {
  if (!(await claimNotificationSend(job.userId, job.kind, job.ref))) return "already-claimed";

  const token = createUnsubscribeToken(job.userId, job.kind);
  const body = job.buildBody(`${origin}/unsubscribe?t=${token}`);
  try {
    const result = await sendEmail({ to: job.email, ...body, headers: unsubscribeHeaders(`${origin}/api/unsubscribe?t=${token}`) });
    if (result !== "not-configured") return "sent";
    await releaseNotificationSend(job.userId, job.kind, job.ref);
    errors.push("Email is not configured (RESEND_API_KEY / EMAIL_FROM)");
    return "stop";
  } catch (err) {
    await releaseNotificationSend(job.userId, job.kind, job.ref);
    if (errors.length < MAX_ERRORS_REPORTED) errors.push(errorMessage(err));
    return errorMessage(err).includes(RATE_LIMITED_STATUS) ? "stop" : "failed";
  }
}

/**
 * `origin` is the site URL the links in the emails point to. `deadlineMs` is the time
 * this step may use; what does not fit (that or the daily limit) is counted as
 * `skipped` and goes out on a later run.
 */
export async function runNotificationStep({ now, origin, deadlineMs }: { now: Date; origin: string; deadlineMs: number }): Promise<NotificationRunSummary> {
  const startedAt = Date.now();
  const jobs = await collectNotificationJobs(toIsoDate(now), origin);
  const quota = Math.max(0, NOTIFICATION_DAILY_LIMIT - (await countNotificationSendsToday(now)));

  const summary: NotificationRunSummary = { sent: 0, skipped: 0, errors: [] };
  for (const [index, job] of jobs.entries()) {
    const isOutOfRoom = summary.sent >= quota || Date.now() - startedAt >= deadlineMs;
    if (isOutOfRoom || summary.aborted) {
      summary.skipped = jobs.length - index;
      break;
    }
    const outcome = await deliver(job, origin, summary.errors);
    if (outcome === "stop") summary.aborted = true;
    if (outcome === "sent") {
      summary.sent += 1;
      await sleep(NOTIFICATION_SEND_GAP_MS);
    }
  }
  return summary;
}
