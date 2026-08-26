"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { festivalTimetableSlots, artists } from "@/db/schema";
import { timetableCacheTag } from "./festival-helpers";

export type TimetableSlotRow = {
  artistId: string;
  artistName: string;
  artistImageUrl: string | null;
  startTime: string;
  endTime: string;
  slotOrder: number;
};

export type TimetableStage = {
  stageName: string;
  stageOrder: number;
  slots: TimetableSlotRow[];
};

/**
 * A festival's timetable split by the ISO date (`slotDate`) each slot falls on.
 * Only merged multi-day festivals carry 2+ days; the overwhelming majority of
 * festivals have exactly one, and render identically to the pre-merge shape.
 *
 * `days` is ascending and holds exactly the keys of `stagesByDay`, so callers
 * can drive day tabs off it without re-deriving or sorting the record.
 */
export type TimetableData = {
  days: string[];
  stagesByDay: Record<string, TimetableStage[]>;
};

type TimetableQueryRow = {
  slotDate: string;
  stageName: string;
  stageOrder: number;
  slotOrder: number;
  startTime: string;
  endTime: string;
  artistId: string;
  artistName: string;
  artistImageUrl: string | null;
};

/** Day → stage identity → stage, preserving first-seen insertion order. */
type StagesByDay = Map<string, Map<string, TimetableStage>>;

/**
 * Identifies a stage within a single day. `stageOrder` alone isn't unique once
 * two festivals sharing a date are merged, because each brought its own
 * independent stage numbering starting at 0.
 */
function buildStageKey(row: TimetableQueryRow): string {
  return `${row.stageOrder}|${row.stageName}`;
}

function toSlotRow(row: TimetableQueryRow): TimetableSlotRow {
  return {
    artistId: row.artistId,
    artistName: row.artistName,
    artistImageUrl: row.artistImageUrl,
    startTime: row.startTime,
    endTime: row.endTime,
    slotOrder: row.slotOrder,
  };
}

/** Bucket the flat query rows into day → stage → slots. */
function groupRowsByDayAndStage(rows: TimetableQueryRow[]): StagesByDay {
  const byDay: StagesByDay = new Map();

  for (const row of rows) {
    let dayStages = byDay.get(row.slotDate);
    if (!dayStages) {
      dayStages = new Map<string, TimetableStage>();
      byDay.set(row.slotDate, dayStages);
    }

    const stageKey = buildStageKey(row);
    let stage = dayStages.get(stageKey);
    if (!stage) {
      stage = { stageName: row.stageName, stageOrder: row.stageOrder, slots: [] };
      dayStages.set(stageKey, stage);
    }

    stage.slots.push(toSlotRow(row));
  }

  return byDay;
}

function toTimetableData(byDay: StagesByDay): TimetableData {
  const days = [...byDay.keys()].sort();
  const stagesByDay: Record<string, TimetableStage[]> = {};

  for (const day of days) {
    const dayStages = [...(byDay.get(day) ?? new Map<string, TimetableStage>()).values()];
    stagesByDay[day] = dayStages.sort((a, b) => a.stageOrder - b.stageOrder);
  }

  return { days, stagesByDay };
}

const TIMETABLE_CACHE_REVALIDATE_SECONDS = 60 * 60;

/**
 * Fetch all timetable slots for a festival, grouped by day and then by stage.
 * Returns empty `days`/`stagesByDay` when no timetable data exists. Public,
 * non-user-specific data — cached per festival for an hour and tagged so
 * importPFTimetableForFestival (the one path that changes a timetable
 * on demand, admin-only) can invalidate it immediately; any other path that
 * touches a timetable (a re-import, a merge) just waits out the hour.
 */
export async function getTimetable(festivalId: string): Promise<TimetableData> {
  return unstable_cache(
    fetchTimetable,
    ["festival-timetable"],
    { revalidate: TIMETABLE_CACHE_REVALIDATE_SECONDS, tags: [timetableCacheTag(festivalId)] }
  )(festivalId);
}

async function fetchTimetable(festivalId: string): Promise<TimetableData> {
  const rows = await db
    .select({
      slotDate: festivalTimetableSlots.slotDate,
      stageName: festivalTimetableSlots.stageName,
      stageOrder: festivalTimetableSlots.stageOrder,
      slotOrder: festivalTimetableSlots.slotOrder,
      startTime: festivalTimetableSlots.startTime,
      endTime: festivalTimetableSlots.endTime,
      artistId: artists.id,
      artistName: artists.name,
      artistImageUrl: artists.imageUrl,
    })
    .from(festivalTimetableSlots)
    .innerJoin(artists, eq(festivalTimetableSlots.artistId, artists.id))
    .where(eq(festivalTimetableSlots.festivalId, festivalId))
    // `slotDate` leads so a merged multi-day timetable comes back day by day.
    // `slotOrder` still outranks `startTime` within a stage: it carries the
    // source's own running order, which is the only thing that keeps an
    // after-midnight closing set (startTime "00:00") at the END of the night
    // instead of sorting to the top. `startTime` is a final tie-breaker only,
    // for merged days where two sources reused the same slotOrder numbers.
    .orderBy(
      festivalTimetableSlots.slotDate,
      festivalTimetableSlots.stageOrder,
      festivalTimetableSlots.slotOrder,
      festivalTimetableSlots.startTime
    );

  return toTimetableData(groupRowsByDayAndStage(rows));
}
