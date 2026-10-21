'use client'

import { lazy, Suspense, useState } from 'react'
import Sheet, { SheetActions } from '@/components/Sheet'
import { CalendarIcon, MergeIcon, RefreshIcon } from '@/components/icons'
import { reimportFestival } from '@/db/actions/festivals'
import menuStyles from '@/components/SheetMenu.module.css'

const PfTimetableImportModal = lazy(() => import('./PfTimetableImportModal'))
const FestivalMergeModal = lazy(() => import('./FestivalMergeModal'))

type AdminView = 'menu' | 'pfImport' | 'merge' | 'reimport'

interface FestivalAdminMenuProps {
  festivalId: string
  festivalName: string
  onClose: () => void
  onTimetableChanged: () => void
  /** Re-reads the festival after a merge or re-import changed it. */
  onFestivalChanged: () => Promise<void>
}

/** Admin actions for a festival: link a timetable, merge duplicates, re-import. */
export default function FestivalAdminMenu({
  festivalId, festivalName, onClose, onTimetableChanged, onFestivalChanged,
}: FestivalAdminMenuProps) {
  const [view, setView] = useState<AdminView>('menu')
  const [isReimporting, setIsReimporting] = useState(false)

  const handleMerged = async () => {
    // A merge can change the lineup, date range and timetable, so re-read all of it.
    await onFestivalChanged()
    onTimetableChanged()
  }

  const handleReimport = async () => {
    setIsReimporting(true)
    try {
      await reimportFestival(festivalId)
      await onFestivalChanged()
      onClose()
    } finally {
      setIsReimporting(false)
    }
  }

  if (view === 'pfImport') {
    return (
      <Suspense fallback={null}>
        <PfTimetableImportModal festivalId={festivalId} onClose={onClose} onImported={onTimetableChanged} />
      </Suspense>
    )
  }

  if (view === 'merge') {
    return (
      <Suspense fallback={null}>
        <FestivalMergeModal winnerId={festivalId} onClose={onClose} onMerged={handleMerged} />
      </Suspense>
    )
  }

  if (view === 'reimport') {
    return (
      <Sheet title="Re-import festival" eyebrow="Admin · festival" onClose={onClose}>
        <p className="form-hint">
          This clears the whole lineup for <strong>{festivalName}</strong>, including all B2B sets and any artist
          ratings logged for this festival, and re-fetches it from the source. This cannot be undone.
        </p>
        <SheetActions>
          <button type="button" className="btn" onClick={onClose} disabled={isReimporting}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={handleReimport} disabled={isReimporting}>
            {isReimporting ? 'Re-importing…' : 'Re-import festival'}
          </button>
        </SheetActions>
      </Sheet>
    )
  }

  return (
    <Sheet title="Festival" eyebrow="Admin · festival" onClose={onClose}>
      <div className={menuStyles.list}>
        <button type="button" className={menuStyles.item} onClick={() => setView('pfImport')}>
          <CalendarIcon />Link Partyflock timetable
        </button>
        <button type="button" className={menuStyles.item} onClick={() => setView('merge')}>
          <MergeIcon />Merge duplicate festivals
        </button>
        <button type="button" className={`${menuStyles.item} ${menuStyles.danger}`} onClick={() => setView('reimport')}>
          <RefreshIcon />Re-import festival
        </button>
      </div>
    </Sheet>
  )
}
