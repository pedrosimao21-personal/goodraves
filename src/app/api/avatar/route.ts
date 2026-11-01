import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { isRateLimited } from "@/db/rate-limit";
import { saveAvatar } from "@/db/avatar-core";
import { isPhotoStorageConfigured } from "@/services/r2/client";
import { getClientIp } from "@/lib/client-ip";
import { isSameOrigin } from "@/lib/same-origin";
import { inspectAvatarImage } from "@/lib/image-format";
import {
  AVATAR_MAX_BYTES,
  AVATAR_RATE_LIMIT_WINDOW_MS,
  AVATAR_UPLOADS_PER_IP_PER_DAY,
  AVATAR_UPLOADS_PER_USER_PER_DAY,
  AVATAR_UPLOADS_SITE_PER_DAY,
} from "@/lib/constants";

export const runtime = "nodejs";

const TOO_MANY = "Too many photo uploads. Try again tomorrow.";

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Whether this upload is over a daily cap. Each cap is checked only once the one before it
 * passed, so one person's attempts can't use up the site-wide cap alone. The site cap keeps
 * writes to the bucket far under its free tier whatever happens.
 */
async function isOverUploadCaps(userId: string, ip: string): Promise<boolean> {
  const window = AVATAR_RATE_LIMIT_WINDOW_MS;
  if (await isRateLimited(userId, "avatar-upload", AVATAR_UPLOADS_PER_USER_PER_DAY, window)) return true;
  if (await isRateLimited(ip, "avatar-upload-ip", AVATAR_UPLOADS_PER_IP_PER_DAY, window)) return true;
  return isRateLimited("site", "avatar-upload-site", AVATAR_UPLOADS_SITE_PER_DAY, window);
}

/**
 * Uploads the signed-in user's profile photo: the request body is the image itself (the browser
 * has already cropped it square and shrunk it). A cookie-authenticated POST, so it must come from
 * our own pages; size, type and dimensions are checked here rather than trusted.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) return fail("Forbidden", 403);

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Unauthorized", 401);
  if (!isPhotoStorageConfigured()) return fail("Photo upload isn't available right now.", 503);

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > AVATAR_MAX_BYTES) return fail("The photo is too large.", 413);
  if (await isOverUploadCaps(userId, getClientIp(req.headers))) return fail(TOO_MANY, 429);

  const bytes = new Uint8Array(await req.arrayBuffer());
  const inspection = inspectAvatarImage(bytes);
  if ("error" in inspection) return fail(inspection.error, 400);

  const avatarUrl = await saveAvatar(userId, bytes, inspection.image);
  return NextResponse.json({ avatarUrl });
}
