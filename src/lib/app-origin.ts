import { headers } from "next/headers";
import { SITE_URL } from "./site";

/**
 * The origin to put in links we email. Production always uses the canonical
 * site URL: building it from the Host header would let anyone request a reset
 * mail whose link points at a domain they control. Locally the request's own
 * host is used, so a link in a dev email opens the dev server.
 */
export async function getAppOrigin(): Promise<string> {
  if (process.env.NODE_ENV === "production") return SITE_URL;
  const host = (await headers()).get("host");
  return host ? `http://${host}` : SITE_URL;
}
