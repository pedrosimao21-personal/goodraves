'use client'

import { useMemo } from 'react'
import { useUserDataActions } from '@/context/UserDataContext'
import FestivalRow from './FestivalRow'
import styles from './Dashboard.module.css'

const UNDATED = 'Undated'

interface FestivalListProps {
  festivalIds: string[]
  isUpcoming: boolean
  onRemove: (id: string) => void
  onEdit?: (id: string) => void
  onClear: () => void
}

/** Past festivals grouped by year (newest first); upcoming as one list. */
export default function FestivalList({ festivalIds, isUpcoming, onRemove, onEdit, onClear }: FestivalListProps) {
  const { getFestivalMeta } = useUserDataActions()

  const groups = useMemo(() => {
    if (isUpcoming) return [{ label: null as string | null, ids: festivalIds }]
    const byYear = new Map<string, string[]>()
    for (const id of festivalIds) {
      const year = getFestivalMeta(id)?.date?.slice(0, 4) ?? UNDATED
      byYear.set(year, [...(byYear.get(year) ?? []), id])
    }
    return [...byYear].map(([label, ids]) => ({ label: label as string | null, ids }))
  }, [festivalIds, isUpcoming, getFestivalMeta])

  return (
    <div>
      {groups.map(group => (
        <section key={group.label ?? 'all'}>
          {group.label && (
            <div className={styles.yearHeader}>
              <h2 className={`display ${styles.yearTitle}`}>{group.label}</h2>
              <span className={`mono ${styles.muted}`}>{group.ids.length} festival{group.ids.length === 1 ? '' : 's'}</span>
            </div>
          )}
          <div className={isUpcoming ? styles.upcomingList : undefined}>
            {group.ids.map(id => (
              <FestivalRow key={id} eventId={id} onRemove={onRemove} isUpcomingTab={isUpcoming} onEdit={onEdit} />
            ))}
          </div>
        </section>
      ))}
      <button type="button" className={`mono ${styles.clearButton}`} onClick={onClear}>
        Clear {isUpcoming ? 'upcoming' : 'past'} list
      </button>
    </div>
  )
}
