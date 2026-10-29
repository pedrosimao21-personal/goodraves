import { db } from "@/db";
import { eq } from "drizzle-orm";
import { artists } from "@/db/schema";
import { parsePhotoLink } from "@/lib/photo-link";
import { lookupRAArtistBySlug } from "@/services/ra/artist-profile";
import { spotifyGetArtist } from "@/services/spotify/client";

/** The rest of the artist data derived from a Spotify link, dropped when an admin points the artist at a different one. */
const DERIVED_FROM_SPOTIFY_LINK = {
  spotifyAlbums: null,
  relatedArtists: null,
  relatedArtistsFetchedAt: null,
  lastfmTopTracks: null,
  lastfmFetchedAt: null,
  spotifyFetchedAt: null,
} as const;

const MANUAL_PHOTO = { imageSource: "manual", imageLocked: true } as const;

async function setPhoto(artistId: string, fields: Partial<typeof artists.$inferInsert>): Promise<void> {
  await db.update(artists).set(fields).where(eq(artists.id, artistId));
}

/**
 * Fix an artist's photo from a pasted link, and lock it so no automatic lookup
 * replaces it. A Spotify link also becomes the artist's Spotify match (the
 * albums and tracks on their page follow it); an RA link also records the RA
 * profile. Returns the new photo URL, or throws a message fit to show the admin.
 */
export async function setArtistPhotoFromLinkCore(artistId: string, link: string): Promise<string> {
  const parsed = parsePhotoLink(link);
  if (!parsed) throw new Error("Paste a Spotify artist link, a Resident Advisor DJ page, or an image link from a site we already show images from.");

  if (parsed.kind === "image") {
    await setPhoto(artistId, { imageUrl: parsed.url, ...MANUAL_PHOTO });
    return parsed.url;
  }

  if (parsed.kind === "spotify") {
    const spotify = await spotifyGetArtist(parsed.artistId).catch(() => null);
    if (!spotify?.image) throw new Error("That Spotify artist has no photo, or the link did not resolve.");
    await setPhoto(artistId, {
      imageUrl: spotify.image,
      spotifyId: spotify.id,
      spotifyFollowers: spotify.followers,
      spotifyVerifiedAt: new Date(),
      ...DERIVED_FROM_SPOTIFY_LINK,
      ...MANUAL_PHOTO,
    });
    return spotify.image;
  }

  const lookup = await lookupRAArtistBySlug(parsed.slug);
  if (lookup.status !== "found" || !lookup.profile.imageUrl) throw new Error("That Resident Advisor page has no profile photo, or the link did not resolve.");
  await setPhoto(artistId, {
    imageUrl: lookup.profile.imageUrl,
    raArtistId: lookup.profile.raArtistId,
    raPhotoCheckedAt: new Date(),
    ...MANUAL_PHOTO,
  });
  return lookup.profile.imageUrl;
}

/** No photo for this artist, and none will be looked up again until an admin resets it. */
export async function removeArtistPhotoCore(artistId: string): Promise<void> {
  await setPhoto(artistId, { imageUrl: null, imageSource: null, imageLocked: true });
}

/** Hand the photo back to the automatic lookups: Resident Advisor first, then Spotify. */
export async function resetArtistPhotoCore(artistId: string): Promise<void> {
  await setPhoto(artistId, { imageSource: null, imageLocked: false, raPhotoCheckedAt: null });
}
