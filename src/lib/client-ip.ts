/**
 * Derive the client IP from request headers for rate-limiting.
 *
 * IMPORTANT: this deliberately does NOT use the leftmost `X-Forwarded-For`
 * entry. That value is client-supplied and trivially spoofable, so keying a rate
 * limit on it lets an attacker rotate fake IPs and bypass the limit entirely.
 *
 * On this app's deployment (Vercel) `x-real-ip` always holds the true client IP,
 * so that is the primary and authoritative source. The RIGHTMOST XFF entry is a
 * best-effort fallback for non-Vercel/self-host setups — it is the hop appended
 * by the nearest trusted proxy, strictly more trustworthy than the leftmost. Note
 * its limitation: behind a shared LB with no `x-real-ip`, it can be one IP for
 * many clients (buckets collapse to that hop). We still prefer it over returning
 * a constant, which would guarantee that collapse for everyone.
 */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}
