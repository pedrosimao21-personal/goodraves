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

/** Fetch the raw HTML of a partyflock.nl event page by party ID. */
export async function fetchPFEventHtml(
  partyId: string
): Promise<string | null> {
  try {
    const res = await fetch(`${PF_BASE_URL}/party/${partyId}`, {
      headers: {
        "User-Agent": PF_USER_AGENT,
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      throw new Error(
        `partyflock.nl returned ${res.status} for party ${partyId}`
      );
    }

    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("windows-1252");
    return decoder.decode(buffer);
  } catch (err) {
    console.error(
      `[partyflock/client] Failed to fetch event ${partyId}:`,
      err
    );
    return null;
  }
}

/** Extract a Partyflock party ID from a partyflock.nl URL. */
export async function extractPFPartyId(input: string): Promise<string | null> {
  const match = input.match(/partyflock\.nl\/party\/(\d+)/);
  return match ? match[1] : null;
}
