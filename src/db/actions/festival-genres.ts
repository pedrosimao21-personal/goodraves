import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { genres, festivalGenres } from "@/db/schema";

/**
 * Replace a festival's linked genres with `genreNames`, creating any genre rows
 * that don't exist yet (insert-if-missing on the unique `genres.name`).
 *
 * Unlike the artist genre sync (allow-list only), this seeds new genre rows so
 * every Partyflock genre reliably appears. Names are normalized to lowercase/
 * trimmed to match existing rows (all stored lowercase). The existing links are
 * always cleared first, so a re-import that finds no genres removes stale rows.
 */
export async function syncFestivalGenres(
  festivalId: string,
  genreNames: string[]
): Promise<void> {
  const names = Array.from(
    new Set(genreNames.map((n) => n.trim().toLowerCase()).filter(Boolean))
  );

  await db.delete(festivalGenres).where(eq(festivalGenres.festivalId, festivalId));
  if (names.length === 0) return;

  // Insert-if-missing: add any genres we haven't seen before, then resolve ids.
  await db.insert(genres).values(names.map((name) => ({ name }))).onConflictDoNothing();

  const rows = await db
    .select({ id: genres.id })
    .from(genres)
    .where(inArray(genres.name, names));
  if (rows.length === 0) return;

  await db
    .insert(festivalGenres)
    .values(rows.map(({ id }) => ({ festivalId, genreId: id })));
}

/** Genre names linked to a single festival. */
export async function fetchFestivalGenres(festivalId: string): Promise<string[]> {
  const rows = await db
    .select({ name: genres.name })
    .from(festivalGenres)
    .innerJoin(genres, eq(festivalGenres.genreId, genres.id))
    .where(eq(festivalGenres.festivalId, festivalId));
  return rows.map((r) => r.name);
}

/** Genre names for many festivals at once, grouped by festival id. */
export async function fetchFestivalGenresByIds(
  festivalIds: string[]
): Promise<Map<string, string[]>> {
  const byFestival = new Map<string, string[]>();
  if (festivalIds.length === 0) return byFestival;

  const rows = await db
    .select({ festivalId: festivalGenres.festivalId, name: genres.name })
    .from(festivalGenres)
    .innerJoin(genres, eq(festivalGenres.genreId, genres.id))
    .where(inArray(festivalGenres.festivalId, festivalIds));

  for (const row of rows) {
    const list = byFestival.get(row.festivalId) ?? [];
    list.push(row.name);
    byFestival.set(row.festivalId, list);
  }
  return byFestival;
}
