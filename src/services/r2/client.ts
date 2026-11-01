import { AwsClient } from "aws4fetch";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { AVATAR_CACHE_CONTROL } from "@/lib/constants";

/**
 * Profile photos in Cloudflare R2 over its S3-compatible API, signed with aws4fetch.
 * Plain server-only transport module, deliberately NOT `"use server"` (that would expose
 * the upload and delete functions as public Server Actions). Call only from `src/db/*`.
 *
 * Needs R2_ENDPOINT (the account's S3 URL, `.eu.` for an EU-jurisdiction bucket, without
 * the bucket name), R2_BUCKET, R2_PUBLIC_URL (the domain the bucket is served from),
 * R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (a token limited to this bucket).
 * Only PUT and DELETE are used: neither counts as a costly "Class A" listing.
 */

const R2_REGION = "auto";
const S3_SERVICE = "s3";

type R2Config = { endpoint: string; bucket: string; publicUrl: string; accessKeyId: string; secretAccessKey: string };

function readConfig(): R2Config | null {
  const { R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_BUCKET || !R2_PUBLIC_URL || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return {
    endpoint: R2_ENDPOINT.replace(/\/+$/, ""),
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL.replace(/\/+$/, ""),
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  };
}

/** False until the bucket's settings are in the environment: uploads then say they are unavailable. */
export function isPhotoStorageConfigured(): boolean {
  return readConfig() !== null;
}

function requireConfig(): R2Config {
  const config = readConfig();
  if (!config) throw new Error("Photo storage is not configured");
  return config;
}

async function signedRequest(config: R2Config, key: string, init: { method: "PUT" | "DELETE"; headers?: Record<string, string>; body?: BodyInit }): Promise<Response> {
  const client = new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, region: R2_REGION, service: S3_SERVICE });
  const request = await client.sign(`${config.endpoint}/${config.bucket}/${key}`, init);
  return fetchWithTimeout(request.url, { method: request.method, headers: request.headers, body: init.body });
}

/** The address a stored object is served from. */
export function photoPublicUrl(key: string): string {
  return `${requireConfig().publicUrl}/${key}`;
}

/** The object key behind one of our public photo URLs, or null for any other URL. */
export function photoKeyFromUrl(url: string): string | null {
  const config = readConfig();
  if (!config || !url.startsWith(`${config.publicUrl}/`)) return null;
  return url.slice(config.publicUrl.length + 1);
}

/** Stores a photo. The name is never reused; the cache lifetime is a day so a deleted photo stops being served soon. */
export async function putPhoto(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const config = requireConfig();
  const res = await signedRequest(config, key, {
    method: "PUT",
    headers: { "Content-Type": contentType, "Cache-Control": AVATAR_CACHE_CONTROL },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
}

/** Removes a photo. A missing object is fine (R2 answers 204 either way). */
export async function deletePhoto(key: string): Promise<void> {
  const res = await signedRequest(requireConfig(), key, { method: "DELETE" });
  if (!res.ok) throw new Error(`R2 delete failed (${res.status})`);
}
