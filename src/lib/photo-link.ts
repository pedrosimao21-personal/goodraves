import { isAllowedImageHost } from "./imageHosts";

/** What an admin pasted to fix an artist's photo. */
export type PhotoLink =
  | { kind: "spotify"; artistId: string }
  | { kind: "ra"; slug: string }
  | { kind: "image"; url: string };

const SPOTIFY_ARTIST_ID = /^[A-Za-z0-9]{22}$/;
const RA_SLUG = /^[a-z0-9][a-z0-9-]*$/;

function parseSpotifyUri(input: string): PhotoLink | null {
  const match = /^spotify:artist:([A-Za-z0-9]{22})$/.exec(input);
  return match ? { kind: "spotify", artistId: match[1] } : null;
}

/**
 * Recognises a Spotify artist link (open.spotify.com/artist/<id> or a spotify:
 * URI), a Resident Advisor DJ page (ra.co/dj/<slug>) or a direct https image
 * URL on one of the hosts the site already allows for images. Anything else is null.
 */
export function parsePhotoLink(rawInput: string): PhotoLink | null {
  const input = rawInput.trim();
  const fromUri = parseSpotifyUri(input);
  if (fromUri) return fromUri;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const host = url.hostname.replace(/^www\./, "");
  if (host === "open.spotify.com") {
    const artistIndex = segments.indexOf("artist");
    const id = artistIndex >= 0 ? segments[artistIndex + 1] : undefined;
    return id && SPOTIFY_ARTIST_ID.test(id) ? { kind: "spotify", artistId: id } : null;
  }
  if (host === "ra.co" && segments[0] === "dj" && segments[1] && RA_SLUG.test(segments[1])) {
    return { kind: "ra", slug: segments[1] };
  }
  return isAllowedImageHost(input) ? { kind: "image", url: input } : null;
}
