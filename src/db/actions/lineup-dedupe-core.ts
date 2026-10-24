import { db } from "@/db";
import { inArray, sql } from "drizzle-orm";
import { artists, festivalArtists, festivals } from "@/db/schema";
import { foldArtistName } from "@/lib/lineup-name";
import { mergeLineupArtistsCore } from "./lineup-admin-core";

export type LineupDedupeSummary = { groups: number; merged: number; errors: string[] };

type Entry = { festivalId: string; festivalName: string; artistId: string; name: string; spotifyId: string | null };

async function fetchLineupEntries(): Promise<Entry[]> {
  return db
    .select({
      festivalId: festivalArtists.festivalId,
      festivalName: festivals.name,
      artistId: artists.id,
      name: artists.name,
      spotifyId: artists.spotifyId,
    })
    .from(festivalArtists)
    .innerJoin(artists, sql`${artists.id} = ${festivalArtists.artistId}`)
    .innerJoin(festivals, sql`${festivals.id} = ${festivalArtists.festivalId}`);
}

/** Lineup groups where two or more artist rows fold to the same name within one festival. */
function findDuplicateGroups(entries: Entry[]): Entry[][] {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = `${entry.festivalId}|${foldArtistName(entry.name)}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

async function fetchFestivalCounts(artistIds: string[]): Promise<Map<string, number>> {
  if (artistIds.length === 0) return new Map();
  const rows = await db
    .select({ artistId: festivalArtists.artistId, count: sql<number>`count(*)` })
    .from(festivalArtists)
    .where(inArray(festivalArtists.artistId, artistIds))
    .groupBy(festivalArtists.artistId);
  return new Map(rows.map((row) => [row.artistId, Number(row.count)]));
}

/** The spelling to keep: the one with a Spotify match, then the one on more festivals. */
function rankKeepers(group: Entry[], counts: Map<string, number>): Entry[] {
  return [...group].sort(
    (a, b) =>
      Number(b.spotifyId !== null) - Number(a.spotifyId !== null) ||
      (counts.get(b.artistId) ?? 0) - (counts.get(a.artistId) ?? 0)
  );
}

function describe(entry: Entry, counts: Map<string, number>): string {
  return `"${entry.name}" (${entry.spotifyId ? "spotify" : "no spotify"}, ${counts.get(entry.artistId) ?? 0} festival(s))`;
}

/**
 * One-off cleanup of lineups that list the same artist twice under spellings
 * that differ only by accents or punctuation ("Adrián Mills" / "Adrian Mills").
 * Each duplicate is merged into the better record per festival, which also
 * records the redirect so a re-import can't bring it back. A dry run only logs.
 */
export async function runLineupDedupe(opts: { dryRun?: boolean; log?: (line: string) => void } = {}): Promise<LineupDedupeSummary> {
  const log = opts.log ?? (() => undefined);
  const groups = findDuplicateGroups(await fetchLineupEntries());
  const counts = await fetchFestivalCounts([...new Set(groups.flat().map((entry) => entry.artistId))]);
  const summary: LineupDedupeSummary = { groups: groups.length, merged: 0, errors: [] };

  for (const group of groups) {
    const [keeper, ...duplicates] = rankKeepers(group, counts);
    log(`${keeper.festivalName} (${keeper.festivalId}): keep ${describe(keeper, counts)}`);
    for (const duplicate of duplicates) {
      log(`    merge ${describe(duplicate, counts)}`);
      if (opts.dryRun) continue;
      try {
        await mergeLineupArtistsCore(keeper.festivalId, duplicate.artistId, keeper.artistId);
        summary.merged += 1;
      } catch (err) {
        summary.errors.push(`${duplicate.festivalId} ${duplicate.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return summary;
}
