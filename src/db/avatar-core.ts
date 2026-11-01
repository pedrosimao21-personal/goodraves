import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { deletePhoto, photoKeyFromUrl, photoPublicUrl, putPhoto } from "@/services/r2/client";
import type { AvatarImage } from "@/lib/image-format";

/**
 * A user's profile photo: the file in the R2 bucket and the `users.avatar_url` that points at
 * it. At most one file per user: replacing or removing a photo deletes the old file, so storage
 * stays at a few KB per user. Plain server module (not `"use server"`): the upload route, the
 * profile actions and account deletion all use it.
 */

export async function getAvatarUrl(userId: string): Promise<string | null> {
  const [row] = await db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.avatarUrl ?? null;
}

/**
 * Deletes the file behind a photo URL. Never throws: a file left behind is a few KB, not a
 * reason to fail what the user asked for. Returns whether the file is gone.
 */
export async function deleteStoredPhoto(url: string | null): Promise<boolean> {
  const key = url ? photoKeyFromUrl(url) : null;
  if (!key) return true;
  return deletePhoto(key).then(
    () => true,
    (err) => {
      console.error("[avatar] could not delete", key, err);
      return false;
    }
  );
}

/** Stores a checked image as the user's new photo and returns its public URL. The previous file is deleted. */
export async function saveAvatar(userId: string, bytes: Uint8Array, image: AvatarImage): Promise<string> {
  const previousUrl = await getAvatarUrl(userId);
  const key = `avatars/${userId}/${randomUUID()}.${image.extension}`;
  await putPhoto(key, bytes, image.mime);

  const url = photoPublicUrl(key);
  try {
    await db.update(users).set({ avatarUrl: url }).where(eq(users.id, userId));
  } catch (err) {
    await deleteStoredPhoto(url);
    throw err;
  }
  await deleteStoredPhoto(previousUrl);
  return url;
}

/** Back to the initial: clears the URL, then deletes the file. */
export async function removeAvatar(userId: string): Promise<void> {
  const previousUrl = await getAvatarUrl(userId);
  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, userId));
  await deleteStoredPhoto(previousUrl);
}
