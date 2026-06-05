"use server";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists, artists } from "@/db/schema";
import { MAX_QUERY_LENGTH, SEARCH_CACHE_TTL_MS } from "./festival-helpers";
import { searchRAEventsRaw } from "@/services/ra/client";
import { mapRAEventToSearchResult } from "@/services/ra/parser";
import { searchFFEventsRaw, resolveFFSlug } from "@/services/festivalfans/client";
import { searchPFEventsRaw, resolvePFEventSlug } from "@/services/partyflock/client";
import { parsePFSearchResults } from "@/services/partyflock/parser";

// ── DB search ──────────────────────────────────────────
const SEARCH_RESULTS_LIMIT = 100;
const FF_DEFAULT_COUNTRY = "Netherlands";

export async function searchFestivalsDB(query: string) {
  if (!query || query.length > MAX_QUERY_LENGTH) return [];

  const escaped = query.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const results = await db
    .selectDistinctOn([festivals.id], {
      id: festivals.id,
      name: festivals.name,
      date: festivals.date,
      endDate: festivals.endDate,
      location: festivals.location,
      venue: festivals.venue,
      latitude: festivals.latitude,
      longitude: festivals.longitude,
      source: festivals.source,
      sourceId: festivals.sourceId,
      imageUrl: festivals.imageUrl,
    })
    .from(festivals)
    .leftJoin(festivalArtists, eq(festivals.id, festivalArtists.festivalId))
    .leftJoin(artists, eq(festivalArtists.artistId, artists.id))
    .where(
      sql`${festivals.name} ILIKE ${pattern} OR ${festivals.venue} ILIKE ${pattern} OR ${festivals.location} ILIKE ${pattern} OR ${artists.name} ILIKE ${pattern}`
    )
    .orderBy(festivals.id, festivals.date)
    .limit(SEARCH_RESULTS_LIMIT);

  return results;
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

  const rawResults = await searchRAEventsRaw(query);
  const mapped = rawResults
    .map(mapRAEventToSearchResult)
    .filter(Boolean);

  raSearchCache.set(cacheKey, { data: mapped, ts: Date.now() });
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
        imageUrl: null as string | null,
        lineup: [] as string[],
        latitude: null as number | null,
        longitude: null as number | null,
      };
    })
  );

  ffSearchCache.set(cacheKey, { data: results, ts: Date.now() });
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
  return mapped;
}
