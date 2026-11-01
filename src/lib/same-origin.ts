/**
 * CSRF protection for the cookie-less POST routes: require a same-origin
 * request. A missing Origin header fails, and the host is compared exactly (not
 * by substring) so a hostile origin merely *containing* our host can't pass.
 */
export function isSameOrigin(headers: { get(name: string): string | null }): boolean {
  const origin = headers.get("origin");
  const host = headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
