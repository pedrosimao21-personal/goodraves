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

// ── Search festivals ───────────────────────────────────
export async function searchFestivalsDB(query: string) {
  if (!query || query.length > 200) return [];
  // Escape SQL LIKE wildcards (% and _) in user input
  const escaped = query.replace(/[%_\\]/g, "\\$&");
  const q = `%${escaped}%`;
  // Search in festivals table and festival_artists
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
    .where(
      sql`${festivals.name} ILIKE ${q} OR ${festivals.venue} ILIKE ${q} OR ${festivals.location} ILIKE ${q} OR ${festivalArtists.artistName} ILIKE ${q}`
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
    .select({ artistName: festivalArtists.artistName })
    .from(festivalArtists)
    .where(eq(festivalArtists.festivalId, id));

  return {
    ...festival,
    lineup: lineup.map((r) => r.artistName),
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
  artistName: string
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
        eq(userArtistRatings.artistName, artistName)
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
          eq(userArtistRatings.artistName, artistName)
        )
      );
    return false; // removed
  } else {
    await db
      .insert(userArtistRatings)
      .values({ userId, festivalId, artistName });
    return true; // added
  }
}

// ── Rate an artist at a festival ───────────────────────
export async function rateArtist(
  festivalId: string,
  artistName: string,
  rating: number
) {
  const userId = await requireAuth();
  const validRating = validateRating(rating);
  await db
    .insert(userArtistRatings)
    .values({ userId, festivalId, artistName, rating: validRating })
    .onConflictDoUpdate({
      target: [
        userArtistRatings.userId,
        userArtistRatings.festivalId,
        userArtistRatings.artistName,
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
  let lineups: { festivalId: string; artistName: string }[] = [];
  if (festivalIds.length > 0) {
    lineups = await db
      .select({
        festivalId: festivalArtists.festivalId,
        artistName: festivalArtists.artistName,
      })
      .from(festivalArtists)
      .where(sql`${festivalArtists.festivalId} IN ${festivalIds}`);
  }

  // Fetch genres for all artists the user has seen
  const seenArtistNames = [...new Set(artistRatingsData.map((ar) => ar.artistName))];
  let artistGenres: { name: string; genres: string | null }[] = [];
  if (seenArtistNames.length > 0) {
    artistGenres = await db
      .select({ name: artists.name, genres: artists.genres })
      .from(artists)
      .where(inArray(artists.name, seenArtistNames));
  }

  return {
    festivals: userFestivalsData,
    artistRatings: artistRatingsData,
    globalArtistData,
    lineups,
    artistGenres,
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
      // Ensure all artist names exist in the artists table (FK requirement)
      await db
        .insert(artists)
        .values(data.lineup.map((name) => ({ name })))
        .onConflictDoNothing();

      await db
        .insert(festivalArtists)
        .values(
          data.lineup.map((artistName) => ({
            festivalId: data.id,
            artistName,
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

    const lineupRows = chunk.flatMap((e) =>
      (e.lineup ?? []).map((artistName) => ({
        festivalId: e.id,
        artistName,
      }))
    );

    if (lineupRows.length > 0) {
      // Ensure all artist names exist in the artists table (FK requirement)
      const artistNames = [...new Set(lineupRows.map((r) => r.artistName))];
      await db
        .insert(artists)
        .values(artistNames.map((name) => ({ name })))
        .onConflictDoNothing();

      await db
        .insert(festivalArtists)
        .values(lineupRows)
        .onConflictDoNothing();
    }
  }
}

// ── Global artist rating (not per-festival) ────────────
export async function setGlobalArtistRating(
  artistName: string,
  rating: number
) {
  const userId = await requireAuth();
  const validRating = validateRating(rating);
  await db
    .insert(userArtistGlobal)
    .values({ userId, artistName, rating: validRating })
    .onConflictDoUpdate({
      target: [userArtistGlobal.userId, userArtistGlobal.artistName],
      set: { rating: validRating },
    });
}

// ── Global artist notes ────────────────────────────────
export async function setGlobalArtistNotes(
  artistName: string,
  notes: string
) {
  const userId = await requireAuth();
  if (notes.length > 5000) {
    throw new Error("Notes must be under 5000 characters");
  }
  await db
    .insert(userArtistGlobal)
    .values({ userId, artistName, notes })
    .onConflictDoUpdate({
      target: [userArtistGlobal.userId, userArtistGlobal.artistName],
      set: { notes },
    });
}
