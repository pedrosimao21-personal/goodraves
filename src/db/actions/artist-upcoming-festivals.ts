/**
 * Upcoming-festival reads for a set of artists, straight from our own
 * festival_artists lineups and timetable slots (whatever source a festival was
 * imported from). Shared by /following and the artist page.
 *
 * Plain server-only module, deliberately NOT `"use server"`: callers are
 * Server Actions that already authorize the request; these helpers only take
 * artist/festival ids and return public festival data.
 */

import { db } from "@/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { festivalArtists, festivals, festivalTimetableSlots } from "@/db/schema";
import { toIsoDate } from "@/lib/dates";

export type UpcomingLineupRow = {
  artistId: string;
  festivalId: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  countryName: string | null;
  imageUrl: string | null;
  source: string | null;
};

export type ArtistTimetableSlot = {
  festivalId: string;
  artistId: string;
  slotDate: string;
  stageName: string;
  startTime: string;
  endTime: string;
};

/**
 * Every (artist, festival) lineup pair for festivals that haven't ended yet,
 * soonest first. Compares on end_date when set so a multi-day festival stays
 * listed while it's ongoing.
 */
export async function fetchUpcomingLineupRows(artistIds: string[], limit: number): Promise<UpcomingLineupRow[]> {
  if (artistIds.length === 0) return [];
  const today = toIsoDate(new Date());

  return db
    .select({
      artistId: festivalArtists.artistId,
      festivalId: festivals.id,
      name: festivals.name,
      date: festivals.date,
      endDate: festivals.endDate,
      location: festivals.location,
      venue: festivals.venue,
      countryName: festivals.countryName,
      imageUrl: festivals.imageUrl,
      source: festivals.source,
    })
    .from(festivalArtists)
    .innerJoin(festivals, eq(festivals.id, festivalArtists.festivalId))
    .where(
      and(
        inArray(festivalArtists.artistId, artistIds),
        sql`coalesce(${festivals.endDate}, ${festivals.date}) >= ${today}`
      )
    )
    .orderBy(asc(festivals.date), asc(festivals.name))
    .limit(limit);
}

/** Timetable slots of the given artists at the given festivals. */
export async function fetchArtistTimetableSlots(
  festivalIds: string[],
  artistIds: string[]
): Promise<ArtistTimetableSlot[]> {
  if (festivalIds.length === 0 || artistIds.length === 0) return [];

  return db
    .select({
      festivalId: festivalTimetableSlots.festivalId,
      artistId: festivalTimetableSlots.artistId,
      slotDate: festivalTimetableSlots.slotDate,
      stageName: festivalTimetableSlots.stageName,
      startTime: festivalTimetableSlots.startTime,
      endTime: festivalTimetableSlots.endTime,
    })
    .from(festivalTimetableSlots)
    .where(
      and(
        inArray(festivalTimetableSlots.festivalId, festivalIds),
        inArray(festivalTimetableSlots.artistId, artistIds)
      )
    )
    .orderBy(asc(festivalTimetableSlots.slotDate), asc(festivalTimetableSlots.startTime));
}
