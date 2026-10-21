'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export type LineupView = 'artists' | 'timetable'

const TIMETABLE_HASH = '#timetable'

function readViewFromHash(): LineupView {
  return typeof window !== 'undefined' && window.location.hash === TIMETABLE_HASH ? 'timetable' : 'artists'
}

/** Artists / Timetable switch, mirrored in the URL hash so a link can open the timetable. */
export function useLineupView() {
  const router = useRouter()
  const pathname = usePathname()
  const [view, setView] = useState<LineupView>(readViewFromHash)

  useEffect(() => {
    function onHashChange() {
      setView(readViewFromHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function switchView(next: LineupView) {
    setView(next)
    // router.replace, not a raw `location.hash =`, so Next's client router
    // tracks this history entry and Back from a page opened here re-renders.
    // replace, not push, so switching views is not a Back-button stop.
    router.replace(`${pathname}${next === 'timetable' ? TIMETABLE_HASH : ''}`, { scroll: false })
  }

  return { view, switchView }
}
