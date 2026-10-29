/**
 * Resident Advisor artist profiles: the curated square photo and the name RA
 * spells the artist with. Lookups return an explicit status so a caller can
 * tell "RA has no such artist" (a verdict worth remembering) from "the request
 * failed" (retry later, remember nothing).
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { withRetry } from "@/lib/retry";
import { RA_ARTIST_BASE_URL, RA_GRAPHQL_URL, RA_USER_AGENT } from "./client";

const RETRY_OPTIONS = { retries: 2, baseDelayMs: 300 };

const PROFILE_FIELDS = "id name image country { name urlCode }";

const GET_PROFILE_BY_ID_QUERY = `query GET_ARTIST_PROFILE($id: ID!) { artist(id: $id) { ${PROFILE_FIELDS} } }`;
const GET_PROFILE_BY_SLUG_QUERY = `query GET_ARTIST_PROFILE_BY_SLUG($slug: String!) { artist(slug: $slug) { ${PROFILE_FIELDS} } }`;

export type RAArtistProfile = {
  raArtistId: string;
  name: string | null;
  /** RA's curated square profile photo; null when the artist has none. */
  imageUrl: string | null;
  countryCode: string | null;
  countryName: string | null;
};

export type RAProfileLookup =
  | { status: "found"; profile: RAArtistProfile }
  | { status: "missing" }
  | { status: "error"; error: unknown };

async function postProfileQuery(query: string, variables: Record<string, string>, referer: string): Promise<any> {
  return withRetry(async () => {
    const res = await fetchWithTimeout(RA_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": RA_USER_AGENT, Referer: referer },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`RA API returned ${res.status}`);
    return res.json();
  }, RETRY_OPTIONS);
}

function toLookup(json: any): RAProfileLookup {
  const artist = json?.data?.artist;
  if (!artist?.id) return { status: "missing" };
  return {
    status: "found",
    profile: {
      raArtistId: String(artist.id),
      name: artist.name ?? null,
      imageUrl: artist.image ?? null,
      countryCode: artist.country?.urlCode ?? null,
      countryName: artist.country?.name ?? null,
    },
  };
}

/** An artist by RA's numeric id, the identity RA's own lineups use. */
export async function lookupRAArtistById(raArtistId: string): Promise<RAProfileLookup> {
  try {
    return toLookup(await postProfileQuery(GET_PROFILE_BY_ID_QUERY, { id: raArtistId }, `${RA_ARTIST_BASE_URL}/${raArtistId}`));
  } catch (error) {
    return { status: "error", error };
  }
}

/** RA's slug for a name: lower-case letters and digits only ("Charlotte de Witte" -> "charlottedewitte"). */
export function raSlugFor(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** An artist by RA's slug (derived from the name). The caller must check the returned name matches. */
export async function lookupRAArtistBySlug(slug: string): Promise<RAProfileLookup> {
  if (!slug) return { status: "missing" };
  try {
    return toLookup(await postProfileQuery(GET_PROFILE_BY_SLUG_QUERY, { slug }, `${RA_ARTIST_BASE_URL}/${slug}`));
  } catch (error) {
    return { status: "error", error };
  }
}
