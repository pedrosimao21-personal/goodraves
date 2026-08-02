/**
 * Wikipedia (pageimages) client.
 *
 * NOTE: plain server-only transport module — deliberately NOT `"use server"`
 * (that would expose it as a public Server Action). Call only from
 * `src/db/actions/*`.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { withRetry } from "@/lib/retry";

const THUMBNAIL_SIZE = 600;
const CACHE_REVALIDATE_SECONDS = 86400;
const RETRY_OPTIONS = { retries: 2, baseDelayMs: 300 };

export async function getWikiImage(searchQuery: string) {
  if (!searchQuery) return null;
  try {
    return await withRetry(async () => {
      const res = await fetchWithTimeout(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchQuery)}&prop=pageimages&format=json&pithumbsize=${THUMBNAIL_SIZE}&origin=*`,
        { next: { revalidate: CACHE_REVALIDATE_SECONDS } }
      );

      if (!res.ok) throw new Error(`[wikipedia] API returned status ${res.status} for "${searchQuery}"`);

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        console.warn(`[wikipedia] Non-JSON response (${contentType}) for "${searchQuery}"`);
        return null;
      }

      const data = await res.json();
      const pages = data.query?.pages;
      if (!pages) return null;

      const pageId = Object.keys(pages)[0];
      if (pageId === "-1") return null;

      return pages[pageId]?.thumbnail?.source || null;
    }, RETRY_OPTIONS);
  } catch (err) {
    console.error("Failed to fetch city image from Wikipedia:", err);
    return null;
  }
}
