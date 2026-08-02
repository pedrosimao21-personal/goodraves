import { EXTERNAL_FETCH_TIMEOUT_MS } from "./constants";

/**
 * `fetch()` with a hard timeout, so a hung external endpoint (scraped
 * third-party sources like RA/FestivalFans/Partyflock have no SLA) can't
 * block the calling server action indefinitely.
 */
export function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = EXTERNAL_FETCH_TIMEOUT_MS
): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
