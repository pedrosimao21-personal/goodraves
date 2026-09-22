import { timingSafeEqual } from "crypto";

/**
 * Checks a cron request's `Authorization: Bearer ${CRON_SECRET}` header
 * (Vercel Cron sends it automatically). Constant-time comparison to avoid a
 * timing side-channel. Shared by every route under src/app/api/cron/.
 */
export function isValidCronBearer(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
