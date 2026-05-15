"use server";

/**
 * Partyflock.nl HTTP client.
 * Handles all HTTP communication with partyflock.nl.
 */

const PF_BASE_URL = "https://partyflock.nl";
const PF_USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

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
  return fetchPFPageHtml(`/party/${partyId}`);
}

/** Fetch event HTML by slug (e.g. "the-crave-festival-nl") and extract the party ID. */
export async function resolvePFEventSlug(
  slug: string
): Promise<string | null> {
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
