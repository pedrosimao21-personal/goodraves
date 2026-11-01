"use server";

import { requireAuth } from "./festival-helpers";
import { getAvatarUrl, removeAvatar } from "@/db/avatar-core";

/** The signed-in user's profile photo URL, or null when they show an initial. */
export async function getMyAvatarUrl(): Promise<string | null> {
  return getAvatarUrl(await requireAuth());
}

/** Back to the initial; deletes the stored photo. */
export async function removeMyAvatar(): Promise<void> {
  await removeAvatar(await requireAuth());
}
