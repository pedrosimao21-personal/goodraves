"use server";

import { db } from "@/db";
import { eq, and, sql, ilike, inArray } from "drizzle-orm";
import {
  festivals,
  festivalArtists,
  artists,
  userFestivals,
  userFestivalArtistRatings,
  userArtistGlobal,
  genres,
  artistGenres as artistGenresTable,
} from "@/db/schema";
import { auth } from "../../../auth";

/** Verify the session and return the authenticated userId. Throws if not authenticated. */
async function requireAuth(): Promise<string> {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

/** Clamp a rating to 1-5, or return null if invalid. */
function validateRating(rating: number): number {
  const r = Math.round(rating);
  if (r < 1 || r > 5 || !Number.isFinite(r)) {
    throw new Error("Rating must be between 1 and 5");
  }
  return r;
}

/**
 * Parse RA's `lineup` text field which contains both linked artists
 * (wrapped in `<artist id="...">Name</artist>`) and plain-text artist names.
 * Returns deduplicated artist name list.
 */
function parseRALineup(lineupText: string | null | undefined, fallbackArtists?: string[]): string[] {
  if (!lineupText) return fallbackArtists ?? [];

  const names: string[] = [];
  // Split by newlines; each line is either an <artist> tag, a plain name, or a mix
  for (const rawLine of lineupText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Replace <artist id="...">Name</artist> with just the name
    const cleaned = line.replace(/<artist[^>]*>(.*?)<\/artist>/g, "$1").trim();
    if (!cleaned) continue;

    // Skip lines that are clearly not artist names (hosted by, etc.)
    if (/^hosted by/i.test(cleaned)) continue;

    names.push(cleaned);
  }

  // Deduplicate (case-sensitive since artist names are intentional)
  return [...new Set(names)];
}

/**
 * Ensure artist names exist in the artists table, then return a name→id map.
 */
async function ensureArtistsAndGetIds(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {};

  // Upsert all names
  await db
    .insert(artists)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing();

  // Fetch id→name mapping
  const rows = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(inArray(artists.name, names));

  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.name] = r.id;
  }
  return map;
}

// ── Search festivals ───────────────────────────────────
export async function searchFestivalsDB(query: string) {
  if (!query || query.length > 200) return [];
  // Escape SQL LIKE wildcards (% and _) in user input
  const escaped = query.replace(/[%_\\]/g, "\\$&");
  const q = `%${escaped}%`;
  // Search in festivals table and festival_artists (join through artists for name search)
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
      sql`${festivals.name} ILIKE ${q} OR ${festivals.venue} ILIKE ${q} OR ${festivals.location} ILIKE ${q} OR ${artists.name} ILIKE ${q}`
    )
    .orderBy(festivals.id, festivals.date)
    .limit(100);

  return results;
}

// ── RA search cache (5-minute TTL) ─────────────────────
const raSearchCache = new Map<
  string,
  { data: any[]; ts: number }
>();
const RA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Search Resident Advisor events by keyword ──────────
export async function searchRAEvents(query: string) {
  if (!query || query.length > 200) return [];

  const cacheKey = query.trim().toLowerCase();
  const cached = raSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RA_CACHE_TTL) {
    return cached.data;
  }

  const gql = `
    query SEARCH_EVENTS($title: MatchFilterInputDtoInput) {
      facetedSearch(types: [EVENT], filters: { title: $title }) {
        totalResults
        results {
          data {
            ... on Event {
              id
              title
              startTime
              endTime
              venue {
                name
                area {
                  name
                  country {
                    name
                  }
                }
              }
              images {
                filename
              }
              artists {
                name
              }
              lineup
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://ra.co/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://ra.co/events",
      },
      body: JSON.stringify({
        query: gql,
        variables: {
          title: { value: query },
        },
      }),
    });

    if (!res.ok) return [];
    const json = await res.json();
    const results = json?.data?.facetedSearch?.results ?? [];

    const mapped = results
      .map((r: any) => {
        const e = r?.data;
        if (!e?.id) return null;

        const date = e.startTime
          ? new Date(e.startTime).toISOString().slice(0, 10)
          : null;
        const endDate = e.endTime
          ? new Date(e.endTime).toISOString().slice(0, 10)
          : null;
        const venueName = e.venue?.name ?? null;
        const areaName = e.venue?.area?.name ?? null;
        const countryName = e.venue?.area?.country?.name ?? null;
        const location =
          [areaName, countryName].filter(Boolean).join(", ") || null;

          const artistsFallback = (e.artists ?? [])
            .map((a: any) => a?.name)
            .filter(Boolean) as string[];
          return {
            raId: String(e.id),
            name: e.title ?? "Untitled Event",
            date,
            endDate,
            venue: venueName,
            location,
            imageUrl: e.images?.[0]?.filename ?? null,
            lineup: parseRALineup(e.lineup, artistsFallback),
          };
      })
      .filter(Boolean);

    raSearchCache.set(cacheKey, { data: mapped, ts: Date.now() });
    return mapped;
  } catch {
    return [];
  }
}

// ── Get a single festival with its lineup ──────────────
export async function getFestival(id: string) {
  const [festival] = await db
    .select()
    .from(festivals)
    .where(eq(festivals.id, id))
    .limit(1);

  if (!festival) {
    // Auto-import from RA if the ID looks like ra-{numericId}
    const raMatch = id.match(/^ra-(\d+)$/);
    if (raMatch) {
      const imported = await fetchRAEvent(raMatch[1]);
      if (imported) {
        // Re-query the DB once (no recursion to avoid infinite loops
        // if the insert silently fails via onConflictDoNothing)
        const [importedFestival] = await db
          .select()
          .from(festivals)
          .where(eq(festivals.id, id))
          .limit(1);
        if (!importedFestival) return null;

        const lineup = await db
          .select({ artistId: festivalArtists.artistId, artistName: artists.name })
          .from(festivalArtists)
          .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
          .where(eq(festivalArtists.festivalId, id));

        return {
          ...importedFestival,
          lineup: lineup.map((r) => ({ id: r.artistId, name: r.artistName })),
        };
      }
    }

    // Auto-import from FestivalFans.nl if the ID looks like ff-{slug}
    const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
    if (ffMatch) {
      const imported = await fetchFFEvent(ffMatch[1]);
      if (imported) {
        const [importedFestival] = await db
          .select()
          .from(festivals)
          .where(eq(festivals.id, id))
          .limit(1);
        if (!importedFestival) return null;

        const lineup = await db
          .select({ artistId: festivalArtists.artistId, artistName: artists.name })
          .from(festivalArtists)
          .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
          .where(eq(festivalArtists.festivalId, id));

        return {
          ...importedFestival,
          lineup: lineup.map((r) => ({ id: r.artistId, name: r.artistName })),
        };
      }
    }
    return null;
  }

  let lineup = await db
    .select({ artistId: festivalArtists.artistId, artistName: artists.name })
    .from(festivalArtists)
    .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
    .where(eq(festivalArtists.festivalId, id));

  // If the festival has no lineup and is from FestivalFans, re-fetch to populate it
  if (lineup.length === 0) {
    const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
    if (ffMatch) {
      await fetchFFEvent(ffMatch[1]);
      lineup = await db
        .select({ artistId: festivalArtists.artistId, artistName: artists.name })
        .from(festivalArtists)
        .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
        .where(eq(festivalArtists.festivalId, id));
    }
  }

  return {
    ...festival,
    lineup: lineup.map((r) => ({ id: r.artistId, name: r.artistName })),
  };
}

// ── Add / remove attendance ────────────────────────────
export async function addAttendance(
  festivalId: string,
  status: "attended" | "upcoming" = "attended"
) {
  const userId = await requireAuth();
  await db
    .insert(userFestivals)
    .values({ userId, festivalId, status })
    .onConflictDoUpdate({
      target: [userFestivals.userId, userFestivals.festivalId],
      set: { status },
    });
}

export async function removeAttendance(festivalId: string) {
  const userId = await requireAuth();
  // Remove artist ratings for this festival too
  await db
    .delete(userFestivalArtistRatings)
    .where(
      and(
        eq(userFestivalArtistRatings.userId, userId),
        eq(userFestivalArtistRatings.festivalId, festivalId)
      )
    );
  await db
    .delete(userFestivals)
    .where(
      and(
        eq(userFestivals.userId, userId),
        eq(userFestivals.festivalId, festivalId)
      )
    );
}

// ── Set festival notes ─────────────────────────────────
export async function setFestivalNotes(
  festivalId: string,
  notes: string
) {
  const userId = await requireAuth();
  if (notes.length > 5000) {
    throw new Error("Notes must be under 5000 characters");
  }
  await db
    .insert(userFestivals)
    .values({ userId, festivalId, notes, status: "attended" })
    .onConflictDoUpdate({
      target: [userFestivals.userId, userFestivals.festivalId],
      set: { notes },
    });
}

// ── Rate a festival ────────────────────────────────────
export async function rateFestival(
  festivalId: string,
  rating: number
) {
  const userId = await requireAuth();
  const validRating = validateRating(rating);
  await db
    .insert(userFestivals)
    .values({ userId, festivalId, rating: validRating, status: "attended" })
    .onConflictDoUpdate({
      target: [userFestivals.userId, userFestivals.festivalId],
      set: { rating: validRating },
    });
}

// ── Toggle saw artist (mark/unmark as seen) ────────────
export async function toggleSawArtist(
  festivalId: string,
  artistId: string
) {
  const userId = await requireAuth();
  // Check if already exists
  const [existing] = await db
    .select()
    .from(userFestivalArtistRatings)
    .where(
      and(
        eq(userFestivalArtistRatings.userId, userId),
        eq(userFestivalArtistRatings.festivalId, festivalId),
        eq(userFestivalArtistRatings.artistId, artistId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .delete(userFestivalArtistRatings)
      .where(
        and(
          eq(userFestivalArtistRatings.userId, userId),
          eq(userFestivalArtistRatings.festivalId, festivalId),
          eq(userFestivalArtistRatings.artistId, artistId)
        )
      );
    return false; // removed
  } else {
    await db
      .insert(userFestivalArtistRatings)
      .values({ userId, festivalId, artistId });
    return true; // added
  }
}

// ── Rate an artist at a festival ───────────────────────
export async function rateArtist(
  festivalId: string,
  artistId: string,
  rating: number
) {
  const userId = await requireAuth();
  const validRating = validateRating(rating);
  await db
    .insert(userFestivalArtistRatings)
    .values({ userId, festivalId, artistId, rating: validRating })
    .onConflictDoUpdate({
      target: [
        userFestivalArtistRatings.userId,
        userFestivalArtistRatings.festivalId,
        userFestivalArtistRatings.artistId,
      ],
      set: { rating: validRating },
    });
}

// ── Get all user data (full state load) ────────────────
export async function getFullUserData() {
  const userId = await requireAuth();
  const [userFestivalsData, artistRatingsData, globalArtistData] = await Promise.all([
    db
      .select({
        festivalId: userFestivals.festivalId,
        status: userFestivals.status,
        rating: userFestivals.rating,
        notes: userFestivals.notes,
        name: festivals.name,
        date: festivals.date,
        venue: festivals.venue,
        location: festivals.location,
        imageUrl: festivals.imageUrl,
        source: festivals.source,
      })
      .from(userFestivals)
      .innerJoin(festivals, eq(userFestivals.festivalId, festivals.id))
      .where(eq(userFestivals.userId, userId)),
    db
      .select()
      .from(userFestivalArtistRatings)
      .where(eq(userFestivalArtistRatings.userId, userId)),
    db
      .select()
      .from(userArtistGlobal)
      .where(eq(userArtistGlobal.userId, userId)),
  ]);

  // Also fetch lineups for user's festivals
  const festivalIds = userFestivalsData.map((f) => f.festivalId);
  let lineups: { festivalId: string; artistId: string; artistName: string }[] = [];
  if (festivalIds.length > 0) {
    lineups = await db
      .select({
        festivalId: festivalArtists.festivalId,
        artistId: festivalArtists.artistId,
        artistName: artists.name,
      })
      .from(festivalArtists)
      .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
      .where(sql`${festivalArtists.festivalId} IN ${festivalIds}`);
  }

  // Fetch tags for all artists the user has seen
  const seenArtistIds = [...new Set(artistRatingsData.map((ar) => ar.artistId))];
  let artistGenreData: { id: string; name: string; genres: string[] }[] = [];
  if (seenArtistIds.length > 0) {
    const rows = await db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(inArray(artists.id, seenArtistIds));

    const genreRows = await db
      .select({ artistId: artistGenresTable.artistId, genreName: genres.name })
      .from(artistGenresTable)
      .innerJoin(genres, eq(artistGenresTable.genreId, genres.id))
      .where(inArray(artistGenresTable.artistId, seenArtistIds));

    const genresByArtist = new Map<string, string[]>();
    for (const row of genreRows) {
      const list = genresByArtist.get(row.artistId) ?? [];
      list.push(row.genreName);
      genresByArtist.set(row.artistId, list);
    }

    artistGenreData = rows.map(r => ({
      id: r.id,
      name: r.name,
      genres: genresByArtist.get(r.id) ?? [],
    }));
  }

  return {
    festivals: userFestivalsData,
    artistRatings: artistRatingsData,
    globalArtistData,
    lineups,
    artistGenres: artistGenreData,
  };
}

// ── Upsert a custom festival ──────────────────────────
// Only allows creating new festivals or updating festivals that don't already exist.
// Prevents authenticated users from overwriting other users' festival metadata.
export async function upsertFestival(data: {
  id: string;
  name: string;
  date: string;
  venue?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  source?: string | null;
  lineup?: string[];
}) {
  await requireAuth();

  // Validate inputs
  if (!data.id || !data.name || data.name.length > 500) {
    throw new Error("Invalid festival data");
  }

  await db
    .insert(festivals)
    .values({
      id: data.id,
      name: data.name,
      date: data.date,
      venue: data.venue ?? null,
      location: data.location ?? null,
      imageUrl: data.imageUrl ?? null,
      source: data.source ?? "custom",
    })
    .onConflictDoUpdate({
      target: [festivals.id],
      set: {
        name: data.name,
        date: data.date,
        venue: data.venue ?? null,
        location: data.location ?? null,
        imageUrl: data.imageUrl ?? null,
      },
    });

  // Upsert lineup — only when lineup is explicitly provided (even if empty, to allow clearing)
  if (data.lineup !== undefined) {
    // Delete existing lineup first
    await db
      .delete(festivalArtists)
      .where(eq(festivalArtists.festivalId, data.id));

    if (data.lineup.length > 0) {
      // Ensure all artist names exist in the artists table and get their IDs
      const nameToId = await ensureArtistsAndGetIds(data.lineup);

      await db
        .insert(festivalArtists)
        .values(
          data.lineup
            .filter((name) => nameToId[name])
            .map((name) => ({
              festivalId: data.id,
              artistId: nameToId[name],
            }))
        )
        .onConflictDoNothing();
    }
  }
}

// ── Clear all user festivals by status ─────────────────
export async function clearUserFestivals(
  status: "attended" | "upcoming"
) {
  const userId = await requireAuth();
  // Get festival IDs to clear artist ratings too
  const toDelete = await db
    .select({ festivalId: userFestivals.festivalId })
    .from(userFestivals)
    .where(
      and(eq(userFestivals.userId, userId), eq(userFestivals.status, status))
    );

  const ids = toDelete.map((r) => r.festivalId);
  if (ids.length > 0) {
    await db
      .delete(userFestivalArtistRatings)
      .where(
        and(
          eq(userFestivalArtistRatings.userId, userId),
          sql`${userFestivalArtistRatings.festivalId} IN ${ids}`
        )
      );
  }

  await db
    .delete(userFestivals)
    .where(
      and(eq(userFestivals.userId, userId), eq(userFestivals.status, status))
    );
}

// ── Batch import RA events into festivals table ────────
export async function batchImportFestivals(
  events: Array<{
    id: string;
    name: string;
    date: string;
    venue?: string | null;
    location?: string | null;
    source?: string;
    lineup?: string[];
  }>
) {
  await requireAuth();
  const CHUNK = 50;
  for (let i = 0; i < events.length; i += CHUNK) {
    const chunk = events.slice(i, i + CHUNK);

    await db
      .insert(festivals)
      .values(
        chunk.map((e) => ({
          id: e.id,
          name: e.name,
          date: e.date,
          venue: e.venue ?? null,
          location: e.location ?? null,
          source: e.source ?? "ra",
        }))
      )
      .onConflictDoNothing();

    // Collect all unique artist names from this chunk
    const allArtistNames = [...new Set(chunk.flatMap((e) => e.lineup ?? []))];
    if (allArtistNames.length > 0) {
      const nameToId = await ensureArtistsAndGetIds(allArtistNames);

      const lineupRows = chunk.flatMap((e) =>
        (e.lineup ?? [])
          .filter((name) => nameToId[name])
          .map((name) => ({
            festivalId: e.id,
            artistId: nameToId[name],
          }))
      );

      if (lineupRows.length > 0) {
        await db
          .insert(festivalArtists)
          .values(lineupRows)
          .onConflictDoNothing();
      }
    }
  }
}

// ── Force-reimport an RA event (clears existing lineup, re-fetches from RA) ──
export async function reimportRAEvent(eventId: string): Promise<string | null> {
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;
  const festivalId = `ra-${id}`;

  // Delete existing lineup so fetchRAEvent will re-fetch
  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));

  return fetchRAEvent(eventId, { force: true });
}

// ── Fetch a single RA event by ID from ra.co and save to DB ───
export async function fetchRAEvent(
  eventId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  // Validate input
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;

  const festivalId = `ra-${id}`;

  if (!opts?.force) {
    // Check if already in DB with lineup
    const [existing] = await db
      .select({ id: festivals.id })
      .from(festivals)
      .where(eq(festivals.id, festivalId))
      .limit(1);
    if (existing) {
      // Verify lineup exists — if not, continue to fetch it
      const [hasLineup] = await db
        .select({ artistId: festivalArtists.artistId })
        .from(festivalArtists)
        .where(eq(festivalArtists.festivalId, festivalId))
        .limit(1);
      if (hasLineup) return festivalId;
    }
  }

  // Fetch from RA GraphQL API
  const query = `
    query GET_EVENT($id: ID!) {
      event(id: $id) {
        id
        title
        startTime
        endTime
        venue {
          name
          area {
            name
            country {
              name
            }
          }
        }
        images {
          filename
        }
        artists {
          name
        }
        lineup
      }
    }
  `;

  let data: any;
  try {
    const res = await fetch("https://ra.co/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Referer": `https://ra.co/events/${id}`,
      },
      body: JSON.stringify({ query, variables: { id } }),
    });
    if (!res.ok) {
      console.error(`[fetchRAEvent] RA API returned ${res.status} for event ${id}`);
      return null;
    }
    const json = await res.json();
    data = json?.data?.event;
    if (!data && json?.errors) {
      console.error(`[fetchRAEvent] RA GraphQL errors for event ${id}:`, json.errors);
    }
  } catch (err) {
    console.error(`[fetchRAEvent] Failed to fetch RA event ${id}:`, err);
    return null;
  }

  if (!data) return null;

  // Normalise date
  const date = data.startTime
    ? new Date(data.startTime).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const endDate = data.endTime
    ? new Date(data.endTime).toISOString().slice(0, 10)
    : null;

  const venueName = data.venue?.name ?? null;
  const areaName = data.venue?.area?.name ?? null;
  const countryName = data.venue?.area?.country?.name ?? null;
  const location = [areaName, countryName].filter(Boolean).join(", ") || null;

  const imageUrl = data.images?.[0]?.filename ?? null;

  // Parse full lineup from the text field, falling back to the artists array
  const artistsFallback = (data.artists ?? [])
    .map((a: any) => a?.name)
    .filter(Boolean) as string[];
  const lineup = parseRALineup(data.lineup, artistsFallback);

  // Save to DB
  await db
    .insert(festivals)
    .values({
      id: festivalId,
      name: data.title ?? `RA Event ${id}`,
      date,
      endDate,
      venue: venueName,
      location,
      source: "ra",
      sourceId: id,
      imageUrl,
    })
    .onConflictDoNothing();

  // Save lineup
  if (lineup.length > 0) {
    const nameToId = await ensureArtistsAndGetIds(lineup);

    await db
      .insert(festivalArtists)
      .values(
        lineup
          .filter((name) => nameToId[name])
          .map((name) => ({ festivalId, artistId: nameToId[name] }))
      )
      .onConflictDoNothing();
  }

  return festivalId;
}

// ── FestivalFans.nl search cache (5-minute TTL) ────────
const ffSearchCache = new Map<
  string,
  { data: any[]; ts: number }
>();

/**
 * Extract festival slug from a festivalfans.nl URL.
 * Supports: festivalfans.nl/event/{slug}/
 */
function extractFFSlugInternal(input: string): string | null {
  const match = input.match(/festivalfans\.nl\/event\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

/** Async wrapper for use in client components. */
export async function extractFFSlug(input: string): Promise<string | null> {
  return extractFFSlugInternal(input);
}

/**
 * Parse a Dutch date string like "Donderdag 1 januari 2026" to YYYY-MM-DD.
 */
function parseDutchDate(dateStr: string): string | null {
  const months: Record<string, string> = {
    januari: "01", februari: "02", maart: "03", april: "04",
    mei: "05", juni: "06", juli: "07", augustus: "08",
    september: "09", oktober: "10", november: "11", december: "12",
  };
  // e.g. "Donderdag 1 januari 2026" or "1 januari 2026"
  const match = dateStr.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = months[match[2].toLowerCase()];
  const year = match[3];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Parse festivalfans.nl event page HTML to extract structured data.
 */
function parseFFEventPage(html: string): {
  name: string | null;
  date: string | null;
  endDate: string | null;
  venue: string | null;
  location: string | null;
  time: string | null;
  imageUrl: string | null;
  lineup: string[];
  latitude: number | null;
  longitude: number | null;
} {
  // Extract name from <h1>
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const name = h1Match ? h1Match[1].trim() : null;

  // Extract info table fields
  const getTableField = (label: string): string | null => {
    // Match: <td class="td-{label}">Label</td><td>Value (may contain <a> tags)</td>
    const re = new RegExp(`<td[^>]*class="td-${label}"[^>]*>[^<]*</td>\\s*<td[^>]*>(.*?)</td>`, "is");
    const m = html.match(re);
    if (!m) return null;
    // Strip HTML tags from the value
    return m[1].replace(/<[^>]+>/g, "").trim() || null;
  };

  const dateStr = getTableField("datum");
  let date: string | null = null;
  let endDate: string | null = null;

  if (dateStr) {
    // Handle date ranges like "Zaterdag 9 - Zondag 10 mei 2026" or single dates
    // Try to extract from schema.org JSON-LD first (more reliable)
    date = parseDutchDate(dateStr);
  }

  // Extract from schema.org JSON-LD (most reliable for dates and geo)
  const ldJsonMatch = html.match(/<script type="application\/ld\+json"[^>]*>\s*(\{[^]*?"@type"\s*:\s*"Event"[^]*?\})\s*<\/script>/);
  if (ldJsonMatch) {
    try {
      const ld = JSON.parse(ldJsonMatch[1]);
      if (ld.startDate) {
        date = new Date(ld.startDate).toISOString().slice(0, 10);
      }
      if (ld.endDate && ld.endDate !== ld.startDate) {
        endDate = new Date(ld.endDate).toISOString().slice(0, 10);
      }
    } catch {}
  }

  // Venue from table (plain text, stripping links)
  const venueRaw = getTableField("locatie");
  const venue = venueRaw;

  // City / location from table
  const cityRaw = getTableField("stad");
  const location = cityRaw ? `${cityRaw}, Netherlands` : null;

  // Time
  const time = getTableField("tijd");

  // Image from og:image
  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  const imageUrl = ogImageMatch ? ogImageMatch[1] : null;

  // Lineup: extract artist names from links to /artiest/ pages in the main content
  const lineup: string[] = [];
  // Only extract from content area, not navigation. Find the event-text div.
  const contentMatch = html.match(/<div class="event-text">([\s\S]*)/);
  const contentHtml = contentMatch ? contentMatch[1] : html;

  // Only get artists from the current year section (before any toggle_container divs for previous years)
  const currentYearHtml = contentHtml.split(/<div class="trigger">/)[0] ?? contentHtml;

  let artistMatch;
  const seenNames = new Set<string>();
  const linkRegex = /<a\s+href="https?:\/\/festivalfans\.nl\/artiest\/[^"]*"\s+title="([^"]+)"/g;
  while ((artistMatch = linkRegex.exec(currentYearHtml)) !== null) {
    const artistName = artistMatch[1].trim();
    if (!seenNames.has(artistName)) {
      seenNames.add(artistName);
      lineup.push(artistName);
    }
  }

  // Lat/lng from schema.org JSON-LD
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (ldJsonMatch) {
    try {
      const ld = JSON.parse(ldJsonMatch[1]);
      if (ld.location?.geo) {
        latitude = parseFloat(ld.location.geo.latitude) || null;
        longitude = parseFloat(ld.location.geo.longitude) || null;
      }
    } catch {}
  }

  return { name, date, endDate, venue, location, time, imageUrl, lineup, latitude, longitude };
}

// ── Search FestivalFans.nl events by keyword ──────────
export async function searchFFEvents(query: string) {
  if (!query || query.length > 200) return [];

  const cacheKey = query.trim().toLowerCase();
  const cached = ffSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RA_CACHE_TTL) {
    return cached.data;
  }

  try {
    // Use the JSON search API
    const res = await fetch("https://festivalfans.nl/search.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: `action=zoekbalk&search=${encodeURIComponent(query)}`,
    });

    if (!res.ok) return [];
    const json = await res.json();

    if (!json.results || !Array.isArray(json.results)) return [];

    // Filter out header entries and entries without a URL
    const events = json.results.filter(
      (r: any) => r.type !== "header" && r.url && r.title
    );

    // Resolve slugs by following redirects (HEAD requests in parallel)
    const results = await Promise.all(
      events.map(async (ev: any) => {
        // Resolve the slug from the redirect
        let ffSlug: string | null = null;
        try {
          const permalink = ev.url.startsWith("http")
            ? ev.url
            : `https://festivalfans.nl${ev.url}`;
          const headRes = await fetch(permalink, {
            method: "HEAD",
            redirect: "manual",
          });
          const loc = headRes.headers.get("location");
          if (loc) {
            const slugMatch = loc.match(/\/event\/([a-z0-9-]+)\/?$/i);
            if (slugMatch) ffSlug = slugMatch[1].toLowerCase();
          }
        } catch {}

        // Fallback: derive slug from title
        if (!ffSlug) {
          ffSlug = ev.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        }

        // Parse date from "30 mei 2026" format
        let date: string | null = null;
        if (ev.strtotime) {
          date = new Date(ev.strtotime * 1000).toISOString().slice(0, 10);
        }

        return {
          ffSlug,
          name: ev.title,
          date,
          endDate: null as string | null,
          venue: ev.venue || null,
          location: ev.locatie ? `${ev.locatie}, Netherlands` : null,
          imageUrl: null as string | null,
          lineup: [] as string[],
          latitude: null as number | null,
          longitude: null as number | null,
        };
      })
    );

    ffSearchCache.set(cacheKey, { data: results, ts: Date.now() });
    return results;
  } catch {
    return [];
  }
}

// ── Fetch a single FestivalFans.nl event by slug and save to DB ───
export async function fetchFFEvent(
  slug: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;

  const festivalId = `ff-${slug}`;

  if (!opts?.force) {
    // Check if already in DB with lineup
    const [existing] = await db
      .select({ id: festivals.id })
      .from(festivals)
      .where(eq(festivals.id, festivalId))
      .limit(1);
    if (existing) {
      const [hasLineup] = await db
        .select({ artistId: festivalArtists.artistId })
        .from(festivalArtists)
        .where(eq(festivalArtists.festivalId, festivalId))
        .limit(1);
      if (hasLineup) return festivalId;
    }
  }

  // Fetch the event page
  let html: string;
  try {
    const res = await fetch(`https://festivalfans.nl/event/${slug}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html",
      },
    });
    if (!res.ok) {
      console.error(`[fetchFFEvent] festivalfans.nl returned ${res.status} for slug ${slug}`);
      return null;
    }
    html = await res.text();
  } catch (err) {
    console.error(`[fetchFFEvent] Failed to fetch festivalfans.nl event ${slug}:`, err);
    return null;
  }

  const parsed = parseFFEventPage(html);
  if (!parsed.name) return null;

  const date = parsed.date ?? new Date().toISOString().slice(0, 10);

  // Save to DB
  const festivalValues = {
    id: festivalId,
    name: parsed.name,
    date,
    endDate: parsed.endDate,
    venue: parsed.venue,
    location: parsed.location,
    source: "festivalfans" as const,
    sourceId: slug,
    imageUrl: parsed.imageUrl,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
  };

  if (opts?.force) {
    await db
      .insert(festivals)
      .values(festivalValues)
      .onConflictDoUpdate({
        target: festivals.id,
        set: {
          name: festivalValues.name,
          date: festivalValues.date,
          endDate: festivalValues.endDate,
          venue: festivalValues.venue,
          location: festivalValues.location,
          imageUrl: festivalValues.imageUrl,
          latitude: festivalValues.latitude,
          longitude: festivalValues.longitude,
        },
      });
  } else {
    await db
      .insert(festivals)
      .values(festivalValues)
      .onConflictDoNothing();
  }

  // Save lineup
  if (parsed.lineup.length > 0) {
    const nameToId = await ensureArtistsAndGetIds(parsed.lineup);

    await db
      .insert(festivalArtists)
      .values(
        parsed.lineup
          .filter((name) => nameToId[name])
          .map((name) => ({ festivalId, artistId: nameToId[name] }))
      )
      .onConflictDoNothing();
  }

  return festivalId;
}

// ── Force-reimport a FestivalFans.nl event ──────────────
export async function reimportFFEvent(slug: string): Promise<string | null> {
  if (!slug) return null;
  const festivalId = `ff-${slug}`;

  // Delete existing lineup
  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));

  return fetchFFEvent(slug, { force: true });
}

// ── Global artist rating (not per-festival) ────────────
export async function setGlobalArtistRating(
  artistId: string,
  rating: number
) {
  const userId = await requireAuth();
  const validRating = validateRating(rating);
  await db
    .insert(userArtistGlobal)
    .values({ userId, artistId, rating: validRating })
    .onConflictDoUpdate({
      target: [userArtistGlobal.userId, userArtistGlobal.artistId],
      set: { rating: validRating },
    });
}

// ── Global artist notes ────────────────────────────────
export async function setGlobalArtistNotes(
  artistId: string,
  notes: string
) {
  const userId = await requireAuth();
  if (notes.length > 5000) {
    throw new Error("Notes must be under 5000 characters");
  }
  await db
    .insert(userArtistGlobal)
    .values({ userId, artistId, notes })
    .onConflictDoUpdate({
      target: [userArtistGlobal.userId, userArtistGlobal.artistId],
      set: { notes },
    });
}
