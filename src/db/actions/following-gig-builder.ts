/**
 * Pure shaping for /following: turns flat (artist, festival) lineup rows into
 * one gig per festival, with each followed artist's sets and any clashes
 * between them. No DB access; see following-feed.ts for the queries.
 */

import { doSetsOverlap } from "@/lib/timetable-clash";
import type { ArtistTimetableSlot, UpcomingLineupRow } from "./artist-upcoming-festivals";

export type GigSet = {
  slotDate: string;
  stageName: string;
  startTime: string;
  endTime: string;
};

export type GigArtist = {
  artistId: string;
  name: string;
  imageUrl: string | null;
  sets: GigSet[];
};

export type GigClash = {
  slotDate: string;
  artistA: string;
  artistB: string;
};

export type FollowingGig = {
  festivalId: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  countryName: string | null;
  imageUrl: string | null;
  source: string | null;
  artists: GigArtist[];
  clashes: GigClash[];
  friendsGoing: string[];
};

export type ArtistSummary = { artistId: string; name: string; imageUrl: string | null };

function slotKey(festivalId: string, artistId: string): string {
  return `${festivalId}::${artistId}`;
}

function groupSlots(slots: ArtistTimetableSlot[]): Map<string, GigSet[]> {
  const grouped = new Map<string, GigSet[]>();
  for (const slot of slots) {
    const key = slotKey(slot.festivalId, slot.artistId);
    const list = grouped.get(key) ?? [];
    list.push({ slotDate: slot.slotDate, stageName: slot.stageName, startTime: slot.startTime, endTime: slot.endTime });
    grouped.set(key, list);
  }
  return grouped;
}

/**
 * Pairs of followed artists whose sets overlap on different stages on the
 * same day: you'd have to choose. Same stage means one continuous set (a
 * B2B), not a clash, matching findClashes in timetable-clash.ts.
 */
function isSetClash(setA: GigSet, setB: GigSet): boolean {
  return setA.slotDate === setB.slotDate && setA.stageName !== setB.stageName && doSetsOverlap(setA, setB);
}

function findClashingSet(a: GigArtist, b: GigArtist): GigSet | undefined {
  return a.sets.find((setA) => b.sets.some((setB) => isSetClash(setA, setB)));
}

function findGigClashes(gigArtists: GigArtist[]): GigClash[] {
  const clashes: GigClash[] = [];
  for (let i = 0; i < gigArtists.length; i++) {
    for (let j = i + 1; j < gigArtists.length; j++) {
      const clashingSet = findClashingSet(gigArtists[i], gigArtists[j]);
      if (clashingSet) {
        clashes.push({ slotDate: clashingSet.slotDate, artistA: gigArtists[i].name, artistB: gigArtists[j].name });
      }
    }
  }
  return clashes;
}

function createGig(row: UpcomingLineupRow, friendsGoing: string[]): FollowingGig {
  return {
    festivalId: row.festivalId,
    name: row.name,
    date: row.date,
    endDate: row.endDate,
    location: row.location,
    venue: row.venue,
    countryName: row.countryName,
    imageUrl: row.imageUrl,
    source: row.source,
    artists: [],
    clashes: [],
    friendsGoing,
  };
}

/** One gig per festival, in the rows' (date) order, artists in follow-list order. */
export function buildFollowingGigs(
  rows: UpcomingLineupRow[],
  slots: ArtistTimetableSlot[],
  artistsById: Map<string, ArtistSummary>,
  friendsGoingByFestival: Map<string, string[]>
): FollowingGig[] {
  const setsByKey = groupSlots(slots);
  const gigsById = new Map<string, FollowingGig>();

  for (const row of rows) {
    const artist = artistsById.get(row.artistId);
    if (!artist) continue;
    let gig = gigsById.get(row.festivalId);
    if (!gig) {
      gig = createGig(row, friendsGoingByFestival.get(row.festivalId) ?? []);
      gigsById.set(row.festivalId, gig);
    }
    gig.artists.push({ ...artist, sets: setsByKey.get(slotKey(row.festivalId, row.artistId)) ?? [] });
  }

  const gigs = [...gigsById.values()];
  for (const gig of gigs) {
    gig.clashes = findGigClashes(gig.artists);
  }
  return gigs;
}
