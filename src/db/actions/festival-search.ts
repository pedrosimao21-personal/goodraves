"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { festivals, festivalArtists, artists } from "@/db/schema";
import { MAX_QUERY_LENGTH, SEARCH_CACHE_TTL_MS, enforceRateLimit } from "./festival-helpers";
import {
  RATE_LIMIT_SEARCH_MAX,
  RATE_LIMIT_WINDOW_MS,
  MIN_SEARCH_QUERY_LENGTH,
} from "@/lib/constants";
import { searchRAEventsRaw } from "@/services/ra/client";
import { mapRAEventToSearchResult } from "@/services/ra/parser";
import { searchFFEventsRaw, resolveFFSlug } from "@/services/festivalfans/client";
import { searchPFEventsRaw, resolvePFEventSlug } from "@/services/partyflock/client";
import { parsePFSearchResults } from "@/services/partyflock/parser";
import { fetchFestivalGenresByIds } from "./festival-genres";
import { getCountryIsoCode } from "@/utils/location-normalizer";

const MAX_CACHE_ENTRIES = 50;

function evictOldestIfNeeded(cache: Map<string, { data: any[]; ts: number }>) {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const [key, entry] of cache) {
    if (entry.ts < oldestTs) {
      oldestTs = entry.ts;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

// ── DB search ──────────────────────────────────────────
const SEARCH_RESULTS_LIMIT = 100;
const FF_DEFAULT_COUNTRY = "Netherlands";

/** Row shape returned by the raw festival-search query below. */
type FestivalSearchRow = {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
  sourceId: string | null;
  imageUrl: string | null;
  countryCode: string | null;
  countryName: string | null;
};

export async function searchFestivalsDB(query: string) {
  if (!query || query.length > MAX_QUERY_LENGTH) return [];
  if (query.length < MIN_SEARCH_QUERY_LENGTH) return [];

  const escaped = query.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;

  // Raw SQL because this is a UNION with an outer ORDER BY/LIMIT, which the
  // query builder can't express over a single `.select()`.
  //
  // The matching festival ids are collected by a UNION of two independently
  // indexable branches. Previously the artist match was a correlated EXISTS
  // sitting in a top-level OR next to the three ILIKEs: Postgres cannot use the
  // pg_trgm GIN indexes on festivals.name/venue/location for an OR that
  // contains a correlated subquery, so it seq-scanned festivals and ran the
  // subplan per row. Split apart, branch one is a BitmapOr over the three
  // festival trigram indexes and branch two uses the artists trigram index plus
  // festival_artists_artist_id_idx. UNION also dedupes the ids, so the outer
  // join can't fan out one row per matching lineup artist.
  const result = await db.execute(sql`
    WITH matched_ids AS (
      SELECT ${festivals.id} FROM ${festivals}
      WHERE ${festivals.name} ILIKE ${pattern}
         OR ${festivals.venue} ILIKE ${pattern}
         OR ${festivals.location} ILIKE ${pattern}
      UNION
      SELECT ${festivalArtists.festivalId} FROM ${festivalArtists}
      JOIN ${artists} ON ${artists.id} = ${festivalArtists.artistId}
      WHERE ${artists.name} ILIKE ${pattern}
    )
    SELECT
      ${festivals.id} AS "id",
      ${festivals.name} AS "name",
      ${festivals.date} AS "date",
      ${festivals.endDate} AS "endDate",
      ${festivals.location} AS "location",
      ${festivals.venue} AS "venue",
      ${festivals.latitude} AS "latitude",
      ${festivals.longitude} AS "longitude",
      ${festivals.source} AS "source",
      ${festivals.sourceId} AS "sourceId",
      ${festivals.imageUrl} AS "imageUrl",
      ${festivals.countryCode} AS "countryCode",
      ${festivals.countryName} AS "countryName"
    FROM ${festivals}
    JOIN matched_ids ON matched_ids.id = ${festivals.id}
    -- Newest first: with the SEARCH_RESULTS_LIMIT cap, a broad term (e.g. a city
    -- in venue/location) can match more than 100 rows. Ordering by date DESC
    -- keeps upcoming/recent editions and drops the oldest past ones, rather than
    -- the reverse. Past festivals are still searchable (no date floor) — just not
    -- when a single query overflows the cap.
    ORDER BY ${festivals.date} DESC
    LIMIT ${SEARCH_RESULTS_LIMIT}
  `);

  const results = result.rows as FestivalSearchRow[];

  const genresByFestival = await fetchFestivalGenresByIds(results.map((r) => r.id));

  return results.map((r) => ({
    ...r,
    genres: genresByFestival.get(r.id) ?? [],
  }));
}

// ── RA search (with 5-minute cache) ────────────────────
const raSearchCache = new Map<string, { data: any[]; ts: number }>();

export async function searchRAEvents(query: string) {
  if (!query || query.length > MAX_QUERY_LENGTH) return [];

  const cacheKey = query.trim().toLowerCase();
  const cached = raSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
    return cached.data;
  }

  // Only cache-misses reach the external API — rate-limit those.
  await enforceRateLimit("search", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);

  const rawResults = await searchRAEventsRaw(query);
  const mapped = rawResults
    .map(mapRAEventToSearchResult)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, countryCode: getCountryIsoCode(r.country) }));

  raSearchCache.set(cacheKey, { data: mapped, ts: Date.now() });
  evictOldestIfNeeded(raSearchCache);
  return mapped;
}

// ── FestivalFans.nl search (with 5-minute cache) ──────
const ffSearchCache = new Map<string, { data: any[]; ts: number }>();

export async function searchFFEvents(query: string) {
  if (!query || query.length > MAX_QUERY_LENGTH) return [];

  const cacheKey = query.trim().toLowerCase();
  const cached = ffSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
    return cached.data;
  }

  // Only cache-misses reach the external API — rate-limit those.
  await enforceRateLimit("search", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);

  const rawResults = await searchFFEventsRaw(query);

  const results = await Promise.all(
    rawResults.map(async (ev) => {
      let ffSlug = await resolveFFSlug(ev.url);

      if (!ffSlug) {
        ffSlug = ev.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }

      let date: string | null = null;
      if (ev.strtotime) {
        const localDate = new Date(ev.strtotime * 1000);
        date = localDate
          .toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" })
          .slice(0, 10);
      }

      return {
        ffSlug,
        name: ev.title,
        date,
        endDate: null as string | null,
        venue: ev.venue || null,
        location: ev.locatie ? `${ev.locatie}, ${FF_DEFAULT_COUNTRY}` : null,
        // FestivalFans is Netherlands-only — known unconditionally, no need
        // to derive it from the joined location string.
        countryCode: ev.locatie ? "NL" : null,
        countryName: ev.locatie ? FF_DEFAULT_COUNTRY : null,
        imageUrl: null as string | null,
        lineup: [] as string[],
        latitude: null as number | null,
        longitude: null as number | null,
      };
    })
  );

  ffSearchCache.set(cacheKey, { data: results, ts: Date.now() });
  evictOldestIfNeeded(ffSearchCache);
  return results;
}

// ── Partyflock.nl search (with 5-minute cache) ────────
const pfSearchCache = new Map<string, { data: any[]; ts: number }>();

export async function searchPFEvents(query: string) {
  if (!query || query.length > MAX_QUERY_LENGTH) return [];

  const cacheKey = query.trim().toLowerCase();
  const cached = pfSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
    return cached.data;
  }

  // Only cache-misses reach the external API — rate-limit those.
  await enforceRateLimit("search", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);

  const html = await searchPFEventsRaw(query);
  if (!html) {
    pfSearchCache.set(cacheKey, { data: [], ts: Date.now() });
    return [];
  }

  const parsed = parsePFSearchResults(html);

  // Partyflock series pages use /event/slug instead of /party/DIGITS. Resolve
  // any such slugs to their underlying numeric party ID now so callers always
  // receive a numeric pfId and generate stable /festival/pf-DIGITS URLs.
  const results = (
    await Promise.all(
      parsed.map(async (ev) => {
        if (!ev.pfId.startsWith("event-")) {
          return { ...ev };
        }
        const slug = ev.pfId.replace(/^event-/, "");
        const resolvedId = await resolvePFEventSlug(slug);
        if (!resolvedId) return null;
        return { ...ev, pfId: resolvedId };
      })
    )
  ).filter((ev): ev is NonNullable<typeof ev> => ev !== null);

  const mapped = results.map((ev) => ({
    pfId: ev.pfId,
    name: ev.name,
    date: ev.date,
    endDate: null as string | null,
    venue: ev.venue,
    location: ev.location,
    imageUrl: ev.imageUrl,
    lineup: [] as string[],
    latitude: null as number | null,
    longitude: null as number | null,
  }));

  pfSearchCache.set(cacheKey, { data: mapped, ts: Date.now() });
  evictOldestIfNeeded(pfSearchCache);
  return mapped;
}

/**
 * Resolve a Partyflock event slug (from a pasted /event/<slug> URL) to its
 * numeric party ID. Gated wrapper around the transport client so this network
 * call is only reachable as a rate-limited action, never as a raw endpoint.
 */
export async function resolvePartyflockSlug(slug: string): Promise<string | null> {
  if (!slug || slug.length > MAX_QUERY_LENGTH) return null;
  await enforceRateLimit("search", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);
  return resolvePFEventSlug(slug);
}
