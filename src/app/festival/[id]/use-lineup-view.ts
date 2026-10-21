'use client'

import { useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * `schedule` is the user's picks, `timetable` the full timetable (the Gantt on
 * desktop, "By stage" on mobile), `artists` the A–Z cards. On desktop the
 * schedule sits under the Gantt, so `schedule` and `timetable` look the same
 * there; Lineup.module.css decides what each view shows per breakpoint.
 */
export type LineupView = 'schedule' | 'timetable' | 'artists'

const VIEWS: LineupView[] = ['schedule', 'timetable', 'artists']

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function readHashView(): LineupView | null {
  const hash = window.location.hash.slice(1)
  return VIEWS.find((view) => view === hash) ?? null
}

/**
 * The lineup view, mirrored in the URL hash so a link can open a view
 * (`#timetable`, `#schedule`). Without a hash it falls back to `defaultView`.
 * The server snapshot is "no hash", so the first client render matches the
 * server's and the hash applies right after hydration.
 */
export function useLineupView(defaultView: LineupView) {
  const router = useRouter()
  const pathname = usePathname()
  const hashView = useSyncExternalStore(subscribeToHash, readHashView, () => null)
  const [chosen, setChosen] = useState<LineupView | null>(null)

  function switchView(next: LineupView) {
    setChosen(next)
    // router.replace, not a raw `location.hash =`, so Next's client router
    // tracks this history entry and Back from a page opened here re-renders.
    // replace, not push, so switching views is not a Back-button stop.
    router.replace(`${pathname}#${next}`, { scroll: false })
  }

  return { view: chosen ?? hashView ?? defaultView, switchView }
}
