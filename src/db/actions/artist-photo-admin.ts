"use server";

import { requireAdmin } from "./festival-helpers";
import {
  removeArtistPhotoCore,
  resetArtistPhotoCore,
  setArtistPhotoFromLinkCore,
} from "./artist-photo-admin-core";

const MAX_LINK_LENGTH = 500;

/** Admin: set (and lock) an artist's photo from a Spotify artist, RA DJ page or allowed image link. */
export async function setArtistPhotoFromLink(artistId: string, link: string): Promise<{ imageUrl: string }> {
  await requireAdmin();
  if (typeof link !== "string" || link.length > MAX_LINK_LENGTH) throw new Error("That link is too long.");
  return { imageUrl: await setArtistPhotoFromLinkCore(artistId, link) };
}

/** Admin: remove an artist's photo and keep it removed. */
export async function removeArtistPhoto(artistId: string): Promise<void> {
  await requireAdmin();
  await removeArtistPhotoCore(artistId);
}

/** Admin: put an artist's photo back under automatic matching. */
export async function resetArtistPhoto(artistId: string): Promise<void> {
  await requireAdmin();
  await resetArtistPhotoCore(artistId);
}
