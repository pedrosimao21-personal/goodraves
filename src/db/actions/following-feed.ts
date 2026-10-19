"use server";

import { db } from "@/db";
import { asc, eq } from "drizzle-orm";
import { artists, userArtistFollows, users } from "@/db/schema";
import { requireAuth } from "./festival-helpers";
import { fetchAcceptedFriendIds } from "./friend-ids";
import { fetchFriendsFollowingByArtist, fetchFriendsGoingByFestival } from "./follow-friend-lookups";
import { fetchArtistTimetableSlots, fetchUpcomingLineupRows } from "./artist-upcoming-festivals";
import { buildFollowingGigs, type ArtistSummary, type FollowingGig } from "./following-gig-builder";

// Upper bound on (artist, festival) lineup rows read for one page load. Today
// an artist averages ~1.3 upcoming festivals, so this only bites for someone
// following hundreds of artists; the soonest gigs are kept.
const MAX_FOLLOWING_LINEUP_ROWS = 500;

export type FollowedArtist = ArtistSummary & {
  followedAt: string;
  upcomingCount: number;
  nextGig: { festivalId: string; name: string; date: string } | null;
  friendsFollowing: string[];
};

export type FollowingPageData = {
  artists: FollowedArtist[];
  gigs: FollowingGig[];
  userCity: string | null;
};

async function fetchFollowedArtists(userId: string) {
  return db
    .select({
      artistId: artists.id,
      name: artists.name,
      imageUrl: artists.imageUrl,
      followedAt: userArtistFollows.createdAt,
    })
    .from(userArtistFollows)
    .innerJoin(artists, eq(userArtistFollows.artistId, artists.id))
    .where(eq(userArtistFollows.userId, userId))
    .orderBy(asc(artists.name));
}

async function fetchUserCity(userId: string): Promise<string | null> {
  const [row] = await db.select({ city: users.city }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.city?.trim() || null;
}

function summarizeArtist(
  artist: Awaited<ReturnType<typeof fetchFollowedArtists>>[number],
  gigs: FollowingGig[],
  friendsFollowing: string[]
): FollowedArtist {
  const artistGigs = gigs.filter((gig) => gig.artists.some((a) => a.artistId === artist.artistId));
  const next = artistGigs[0];
  return {
    artistId: artist.artistId,
    name: artist.name,
    imageUrl: artist.imageUrl,
    followedAt: artist.followedAt.toISOString(),
    upcomingCount: artistGigs.length,
    nextGig: next ? { festivalId: next.festivalId, name: next.name, date: next.date } : null,
    friendsFollowing,
  };
}

/** Everything /following shows: followed artists, their upcoming gigs, friend overlays. */
export async function getFollowingPage(): Promise<FollowingPageData> {
  const userId = await requireAuth();
  const [followed, userCity, friendIds] = await Promise.all([
    fetchFollowedArtists(userId),
    fetchUserCity(userId),
    fetchAcceptedFriendIds(userId),
  ]);
  if (followed.length === 0) return { artists: [], gigs: [], userCity };

  const artistIds = followed.map((a) => a.artistId);
  const rows = await fetchUpcomingLineupRows(artistIds, MAX_FOLLOWING_LINEUP_ROWS);
  const festivalIds = [...new Set(rows.map((r) => r.festivalId))];

  const [slots, friendsGoing, friendsFollowing] = await Promise.all([
    fetchArtistTimetableSlots(festivalIds, artistIds),
    fetchFriendsGoingByFestival(friendIds, festivalIds),
    fetchFriendsFollowingByArtist(friendIds, artistIds),
  ]);

  const artistsById = new Map(followed.map((a) => [a.artistId, { artistId: a.artistId, name: a.name, imageUrl: a.imageUrl }]));
  const gigs = buildFollowingGigs(rows, slots, artistsById, friendsGoing);
  const summaries = followed.map((a) => summarizeArtist(a, gigs, friendsFollowing.get(a.artistId) ?? []));

  return { artists: summaries, gigs, userCity };
}
