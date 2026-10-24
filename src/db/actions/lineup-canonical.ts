import { db } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { artists, festivalArtists, festivalLineupExclusions } from "@/db/schema";
import { foldArtistName } from "@/lib/lineup-name";
import { normalizeArtistName } from "@/utils/text-normalizer";

type Exclusions = Map<string, string | null>;

async function fetchExclusions(festivalId: string): Promise<Exclusions> {
  const rows = await db
    .select({ nameKey: festivalLineupExclusions.nameKey, replacedByName: festivalLineupExclusions.replacedByName })
    .from(festivalLineupExclusions)
    .where(eq(festivalLineupExclusions.festivalId, festivalId));
  return new Map(rows.map((row) => [row.nameKey, row.replacedByName]));
}

/** Artist ids for the names an admin merged other artists into (only looked up when a festival has any). */
async function fetchReplacementIds(exclusions: Exclusions): Promise<Map<string, string>> {
  const names = [...new Set([...exclusions.values()].filter((name): name is string => name !== null))];
  if (names.length === 0) return new Map();
  const rows = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(inArray(sql`lower(${artists.name})`, names.map((name) => name.toLowerCase())));
  return new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));
}

/** Of several artist records for one name, the one to keep: already in the lineup, else with a Spotify match, else the first. */
async function pickKeeper(festivalId: string, candidateIds: string[]): Promise<string> {
  const [lineupRows, candidateRows] = await Promise.all([
    db
      .select({ id: festivalArtists.artistId })
      .from(festivalArtists)
      .where(and(eq(festivalArtists.festivalId, festivalId), inArray(festivalArtists.artistId, candidateIds))),
    db
      .select({ id: artists.id, spotifyId: artists.spotifyId })
      .from(artists)
      .where(inArray(artists.id, candidateIds)),
  ]);
  const inLineup = candidateIds.find((id) => lineupRows.some((row) => row.id === id));
  if (inLineup) return inLineup;
  return candidateRows.find((row) => row.spotifyId)?.id ?? candidateIds[0];
}

/**
 * Apply a festival's lineup rules to the artist ids an import just resolved:
 *  - names an admin removed are dropped (they get no lineup row and no slots),
 *  - names an admin merged into another artist point at that artist,
 *  - spellings that fold to the same name ("Adrián Mills" / "Adrian Mills") all
 *    resolve to ONE artist, so the lineup can't hold the same person twice.
 *
 * Returns a fresh name → id map holding only the names that stay, keyed by the
 * exact strings in `names`; callers filter on `nameToId[name]` as before.
 */
export async function canonicalizeLineupIds(
  festivalId: string,
  names: string[],
  nameToId: Record<string, string>
): Promise<Record<string, string>> {
  const exclusions = await fetchExclusions(festivalId);
  const replacementIds = exclusions.size > 0 ? await fetchReplacementIds(exclusions) : new Map<string, string>();

  const idsByKey = new Map<string, string[]>();
  const keyByName = new Map<string, string>();
  const resolvedIdByName = new Map<string, string>();
  for (const name of names) {
    const key = foldArtistName(normalizeArtistName(name));
    let id: string | undefined = nameToId[name];
    if (exclusions.has(key)) {
      const replacedBy = exclusions.get(key);
      if (replacedBy === null) continue;
      id = replacementIds.get(replacedBy!.toLowerCase()) ?? id;
    }
    if (!id) continue;
    keyByName.set(name, key);
    resolvedIdByName.set(name, id);
    const ids = idsByKey.get(key) ?? [];
    if (!ids.includes(id)) ids.push(id);
    idsByKey.set(key, ids);
  }

  const keeperByKey = new Map<string, string>();
  for (const [key, ids] of idsByKey) {
    keeperByKey.set(key, ids.length === 1 ? ids[0] : await pickKeeper(festivalId, ids));
  }

  const result: Record<string, string> = {};
  for (const [name, key] of keyByName) result[name] = keeperByKey.get(key)!;
  return result;
}
