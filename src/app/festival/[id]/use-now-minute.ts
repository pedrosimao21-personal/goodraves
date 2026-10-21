'use client'

import { useMemo, useSyncExternalStore } from 'react'

const MS_PER_MINUTE = 60_000
/** Checks often enough that the minute changes on screen within a few seconds of the clock. */
const TICK_MS = 15_000

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, TICK_MS)
  return () => clearInterval(id)
}

/** The current minute; stable between ticks within that minute, so React sees no change. */
function readMinute(): number {
  return Math.floor(Date.now() / MS_PER_MINUTE) * MS_PER_MINUTE
}

/**
 * The device's current time, rounded down to the minute. Null on the server and
 * during hydration, so anything rendered from it never mismatches the server HTML.
 */
export function useNowMinute(): Date | null {
  const minute = useSyncExternalStore(subscribe, readMinute, () => null)
  return useMemo(() => (minute === null ? null : new Date(minute)), [minute])
}
