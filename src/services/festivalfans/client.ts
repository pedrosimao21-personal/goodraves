/**
 * FestivalFans.nl API client.
 * Handles all HTTP communication with festivalfans.nl.
 *
 * NOTE: this is a plain server-only transport module — it is deliberately NOT a
 * `"use server"` action module. Marking it `"use server"` would register every
 * exported function as a public, unauthenticated Server Action endpoint (SSRF /
 * quota abuse). Call these functions only from `src/db/actions/*`, which apply
 * auth and rate limiting.
 */

const FF_BASE_URL = "https://festivalfans.nl";
const FF_HOST = "festivalfans.nl";
// Slugs are lowercase alphanumerics + hyphens; reject anything else so a caller
// can't smuggle path traversal or query params into the target URL.
const FF_SLUG_RE = /^[a-z0-9-]+$/i;
const FF_USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export type FFSearchResult = {
  title: string;
  url: string;
  venue?: string;
  locatie?: string;
  strtotime?: number;
  type?: string;
};

/** Search festivalfans.nl for events matching a query. Returns raw results. */
export async function searchFFEventsRaw(
  query: string
): Promise<FFSearchResult[]> {
  try {
    const res = await fetch(`${FF_BASE_URL}/search.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: `action=zoekbalk&search=${encodeURIComponent(query)}`,
    });

    if (!res.ok) return [];
    const json = await res.json();

    if (!json.results || !Array.isArray(json.results)) return [];

    return json.results.filter(
      (r: any) => r.type !== "header" && r.url && r.title
    );
  } catch {
    return [];
  }
}

/** Resolve a festivalfans.nl permalink to a canonical event slug via redirect. */
export async function resolveFFSlug(url: string): Promise<string | null> {
  try {
    const permalink = url.startsWith("http")
      ? url
      : `${FF_BASE_URL}${url}`;
    // SSRF guard: only ever issue requests to festivalfans.nl, regardless of
    // what the caller passed. An absolute URL to any other host is rejected.
    if (new URL(permalink).host !== FF_HOST) return null;
    const headRes = await fetch(permalink, {
      method: "HEAD",
      redirect: "manual",
    });
    const loc = headRes.headers.get("location");
    if (loc) {
      const slugMatch = loc.match(/\/event\/([a-z0-9-]+)\/?$/i);
      if (slugMatch) return slugMatch[1].toLowerCase();
    }
  } catch {
    // Redirect resolution failed
  }
  return null;
}

/** Fetch the raw HTML of a festivalfans.nl event page by slug. */
export async function fetchFFEventHtml(
  slug: string
): Promise<string | null> {
  if (!FF_SLUG_RE.test(slug)) return null;
  try {
    const res = await fetch(`${FF_BASE_URL}/event/${slug}/`, {
      headers: {
        "User-Agent": FF_USER_AGENT,
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      throw new Error(
        `festivalfans.nl returned ${res.status} for slug ${slug}`
      );
    }
    return await res.text();
  } catch (err) {
    console.error(
      `[festivalfans/client] Failed to fetch event ${slug}:`,
      err
    );
    return null;
  }
}

/** Extract festival slug from a festivalfans.nl URL. */
export async function extractFFSlug(
  input: string
): Promise<string | null> {
  const match = input.match(/festivalfans\.nl\/event\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}
