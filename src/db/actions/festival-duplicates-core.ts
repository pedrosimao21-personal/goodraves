import { db } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { festivalDuplicateCandidates } from "@/db/schema";

/**
 * Deliberately no "use server" — the review-queue reads/writes behind
 * /admin/duplicates. The admin-gated actions in festival-duplicates.ts and
 * the admin-checked page are the only callers.
 */

export type DuplicateSide = {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  source: string | null;
  imageUrl: string | null;
  artistCount: number;
  slotCount: number;
  attendeeCount: number;
};

export type DuplicateCandidate = {
  reason: string;
  createdAt: string;
  a: DuplicateSide;
  b: DuplicateSide;
  /** The side the merge would keep by default — the one with more data. */
  suggestedWinnerId: string;
};

const MAX_LISTED = 100;

type Row = Record<string, unknown>;

function toSide(row: Row, prefix: "a" | "b"): DuplicateSide {
  const get = (field: string) => row[`${prefix}_${field}`];
  return {
    id: String(get("id")),
    name: String(get("name")),
    date: String(get("date")),
    endDate: (get("end_date") as string | null) ?? null,
    location: (get("location") as string | null) ?? null,
    venue: (get("venue") as string | null) ?? null,
    source: (get("source") as string | null) ?? null,
    imageUrl: (get("image_url") as string | null) ?? null,
    artistCount: Number(get("artists")),
    slotCount: Number(get("slots")),
    attendeeCount: Number(get("attendees")),
  };
}

function suggestWinner(a: DuplicateSide, b: DuplicateSide): string {
  if (a.artistCount !== b.artistCount) return a.artistCount > b.artistCount ? a.id : b.id;
  if ((a.slotCount > 0) !== (b.slotCount > 0)) return a.slotCount > 0 ? a.id : b.id;
  return a.attendeeCount >= b.attendeeCount ? a.id : b.id;
}

const sideColumns = (alias: string) => sql.raw(`
  ${alias}.id AS ${alias}_id, ${alias}.name AS ${alias}_name, ${alias}.date AS ${alias}_date,
  ${alias}.end_date AS ${alias}_end_date, ${alias}.location AS ${alias}_location,
  ${alias}.venue AS ${alias}_venue, ${alias}.source AS ${alias}_source, ${alias}.image_url AS ${alias}_image_url,
  (SELECT count(*)::int FROM festival_artists x WHERE x.festival_id = ${alias}.id) AS ${alias}_artists,
  (SELECT count(*)::int FROM festival_timetable_slots x WHERE x.festival_id = ${alias}.id) AS ${alias}_slots,
  (SELECT count(*)::int FROM user_festivals x WHERE x.festival_id = ${alias}.id) AS ${alias}_attendees`);

export async function listPendingDuplicates(): Promise<DuplicateCandidate[]> {
  const result = await db.execute(sql`
    SELECT c.reason, c.created_at, ${sideColumns("a")}, ${sideColumns("b")}
    FROM festival_duplicate_candidates c
    JOIN festivals a ON a.id = c.festival_a
    JOIN festivals b ON b.id = c.festival_b
    WHERE c.status = 'pending'
    ORDER BY a.date ASC
    LIMIT ${MAX_LISTED}
  `);
  return (result.rows as Row[]).map((row) => {
    const a = toSide(row, "a");
    const b = toSide(row, "b");
    return {
      reason: String(row.reason),
      createdAt: new Date(String(row.created_at)).toISOString(),
      a,
      b,
      suggestedWinnerId: suggestWinner(a, b),
    };
  });
}

export async function isPendingPair(a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ a: festivalDuplicateCandidates.festivalA })
    .from(festivalDuplicateCandidates)
    .where(and(
      eq(festivalDuplicateCandidates.festivalA, a),
      eq(festivalDuplicateCandidates.festivalB, b),
      eq(festivalDuplicateCandidates.status, "pending"),
    ))
    .limit(1);
  return !!row;
}

export async function markPairDismissed(a: string, b: string): Promise<void> {
  await db
    .update(festivalDuplicateCandidates)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(and(eq(festivalDuplicateCandidates.festivalA, a), eq(festivalDuplicateCandidates.festivalB, b)));
}
