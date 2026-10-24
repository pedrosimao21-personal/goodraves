"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, timetableCacheTag } from "./festival-helpers";
import { mergeLineupArtistsCore, removeArtistFromLineupCore } from "./lineup-admin-core";

function refreshFestival(festivalId: string): void {
  revalidateTag(timetableCacheTag(festivalId));
  revalidatePath(`/festival/${festivalId}`);
}

/** Admin: remove an artist from one festival's lineup. Imports won't add it back. */
export async function removeArtistFromLineup(festivalId: string, artistId: string): Promise<{ name: string }> {
  await requireAdmin();
  const name = await removeArtistFromLineupCore(festivalId, artistId);
  refreshFestival(festivalId);
  return { name };
}

/** Admin: fold a duplicate lineup entry into the artist to keep (this festival only). */
export async function mergeLineupArtists(festivalId: string, duplicateId: string, keepId: string): Promise<{ name: string }> {
  await requireAdmin();
  const name = await mergeLineupArtistsCore(festivalId, duplicateId, keepId);
  refreshFestival(festivalId);
  return { name };
}
