"use server";

import { db } from "@/db";
import { eq, and, sql, ilike, inArray } from "drizzle-orm";
import {
  festivals,
  festivalArtists,
  artists,
  userFestivals,
  userArtistRatings,
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

// ── Get a single festival with its lineup ──────────────
export async function getFestival(id: string) {
  const [festival] = await db
    .select()
    .from(festivals)
    .where(eq(festivals.id, id))
    .limit(1);

  if (!festival) return null;

  const lineup = await db
    .select({ artistId: festivalArtists.artistId, artistName: artists.name })
    .from(festivalArtists)
    .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
    .where(eq(festivalArtists.festivalId, id));

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
    .delete(userArtistRatings)
    .where(
      and(
        eq(userArtistRatings.userId, userId),
        eq(userArtistRatings.festivalId, festivalId)
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
    .from(userArtistRatings)
    .where(
      and(
        eq(userArtistRatings.userId, userId),
        eq(userArtistRatings.festivalId, festivalId),
        eq(userArtistRatings.artistId, artistId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .delete(userArtistRatings)
      .where(
        and(
          eq(userArtistRatings.userId, userId),
          eq(userArtistRatings.festivalId, festivalId),
          eq(userArtistRatings.artistId, artistId)
        )
      );
    return false; // removed
  } else {
    await db
      .insert(userArtistRatings)
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
    .insert(userArtistRatings)
    .values({ userId, festivalId, artistId, rating: validRating })
    .onConflictDoUpdate({
      target: [
        userArtistRatings.userId,
        userArtistRatings.festivalId,
        userArtistRatings.artistId,
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
      .from(userArtistRatings)
      .where(eq(userArtistRatings.userId, userId)),
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
      .delete(userArtistRatings)
      .where(
        and(
          eq(userArtistRatings.userId, userId),
          sql`${userArtistRatings.festivalId} IN ${ids}`
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

// ── Fetch a single RA event by ID from ra.co and save to DB ───
export async function fetchRAEvent(eventId: string): Promise<string | null> {
  // Validate input
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;

  const festivalId = `ra-${id}`;

  // Check if already in DB
  const [existing] = await db
    .select({ id: festivals.id })
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);
  if (existing) return festivalId;

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
    if (!res.ok) return null;
    const json = await res.json();
    data = json?.data?.event;
  } catch {
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

  const lineup = (data.artists ?? [])
    .map((a: any) => a?.name)
    .filter(Boolean) as string[];

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
