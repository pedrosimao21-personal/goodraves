/**
 * Partyflock.nl HTTP client.
 * Handles all HTTP communication with partyflock.nl.
 *
 * NOTE: this is a plain server-only transport module — deliberately NOT a
 * `"use server"` action module (that would expose every function as a public,
 * unauthenticated Server Action). Call it only from `src/db/actions/*`.
 */

const PF_BASE_URL = "https://partyflock.nl";
// A party id is digits only; a slug is lowercase alphanumerics + hyphens.
// Validate both so a caller can't inject path traversal / query params.
const PF_PARTY_ID_RE = /^\d+$/;
const PF_SLUG_RE = /^[a-z0-9-]+$/i;
const PF_USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/**
 * Query string for the curated rave agenda (indoor/outdoor/beach, future, genre 3).
 * Mirrors the saved Partyflock agenda search the daily import is built around.
 */
const PF_AGENDA_QUERY =
  "enc=%F0%9F%A5%B0&LOCATIONTYPE%5B%5D=indoor&LOCATIONTYPE%5B%5D=outdoor&LOCATIONTYPE%5B%5D=beach&CB_WHEN=1&WHEN=future&CB_DAYTIME=1&CB_GIDS=1&GID%5B%5D=3";

/** Fetch the Partyflock search page HTML for a given query. */
export async function searchPFEventsRaw(
  query: string
): Promise<string | null> {
  try {
    const url = `${PF_BASE_URL}/search?TERMS=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": PF_USER_AGENT,
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("windows-1252");
    return decoder.decode(buffer);
  } catch {
    return null;
  }
}

/** Fetch the raw HTML of a partyflock.nl page by path (e.g. "/party/123"). */
async function fetchPFPageHtml(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${PF_BASE_URL}${path}`, {
      headers: {
        "User-Agent": PF_USER_AGENT,
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      throw new Error(
        `partyflock.nl returned ${res.status} for ${path}`
      );
    }

    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("windows-1252");
    return decoder.decode(buffer);
  } catch (err) {
    console.error(
      `[partyflock/client] Failed to fetch ${path}:`,
      err
    );
    return null;
  }
}

/** Fetch the raw HTML of a partyflock.nl event page by party ID. */
export async function fetchPFEventHtml(
  partyId: string
): Promise<string | null> {
  if (!PF_PARTY_ID_RE.test(partyId)) return null;
  return fetchPFPageHtml(`/party/${partyId}`);
}

/** Fetch the curated rave agenda search page HTML (future events listing). */
export async function fetchPFAgendaHtml(): Promise<string | null> {
  return fetchPFPageHtml(`/agenda/search?${PF_AGENDA_QUERY}`);
}

/** Fetch event HTML by slug (e.g. "the-crave-festival-nl") and extract the party ID. */
export async function resolvePFEventSlug(
  slug: string
): Promise<string | null> {
  if (!PF_SLUG_RE.test(slug)) return null;
  const html = await fetchPFPageHtml(`/event/${slug}`);
  if (!html) return null;

  const idMatch = html.match(/data-element="party"\s+data-id="(\d+)"/);
  return idMatch ? idMatch[1] : null;
}

/** Extract a Partyflock party ID from a partyflock.nl URL. */
export async function extractPFPartyId(input: string): Promise<string | null> {
  const partyMatch = input.match(/partyflock\.nl\/party\/(\d+)/);
  if (partyMatch) return partyMatch[1];

  const eventMatch = input.match(/partyflock\.nl\/event\/([a-z0-9-]+)/i);
  if (eventMatch) return resolvePFEventSlug(eventMatch[1]);

  return null;
}
