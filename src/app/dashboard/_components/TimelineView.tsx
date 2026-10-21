'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUserData } from '@/context/UserDataContext'
import { parseLocalDate } from '@/lib/dates'
import TimelineCard from './TimelineCard'
import styles from './Timeline.module.css'

const MONTHS = [
  'All', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function buildFestivalList(
  allFestivalIds: string[],
  upcomingFestivalIds: string[],
  getFestivalMeta: (id: string) => ReturnType<ReturnType<typeof useUserData>['getFestivalMeta']>,
  seenArtistsMap: Record<string, string[]>,
  artistMetaMap: Record<string, { name?: string; image?: string | null }>,
  artistRatingsMap: Record<string, number>,
) {
  return allFestivalIds
    .map(id => {
      const meta = getFestivalMeta(id)
      const date = meta?.date ?? null
      const parsedDate = date ? parseLocalDate(date) : null
      const year = parsedDate ? parsedDate.getFullYear() : null
      const month = parsedDate ? parsedDate.getMonth() + 1 : null
      const seenArtists = (seenArtistsMap[id] ?? []).map(aid => ({
        id: aid,
        name: artistMetaMap[aid]?.name ?? aid,
        image: artistMetaMap[aid]?.image ?? null,
        rating: artistRatingsMap[aid] ?? 0,
      }))
      const isUpcoming = upcomingFestivalIds.includes(id)
      return { id, meta, year, month, seenArtists, isUpcoming }
    })
    .filter(f => f.meta != null)
    .sort((a, b) => {
      if (a.meta!.date && b.meta!.date) return a.meta!.date.localeCompare(b.meta!.date)
      return 0
    })
}

interface TimelineViewProps {
  initialYear: number | null
  initialMonth: string
  onYearChange: (year: number) => void
  onMonthChange: (month: string) => void
}

export default function TimelineView({
  initialYear,
  initialMonth,
  onYearChange,
  onMonthChange,
}: TimelineViewProps) {
  const router = useRouter()
  const {
    attendedFestivals,
    upcomingFestivals,
    festivalMeta,
    seenArtists,
    artistMeta,
    artistRatings,
    getFestivalMeta,
  } = useUserData()

  const allFestivalIds = useMemo(
    () => [...new Set([...attendedFestivals, ...upcomingFestivals])],
    [attendedFestivals, upcomingFestivals],
  )

  const festivals = useMemo(
    () => buildFestivalList(allFestivalIds, upcomingFestivals, getFestivalMeta, seenArtists, artistMeta, artistRatings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allFestivalIds, upcomingFestivals, getFestivalMeta, seenArtists, artistMeta, artistRatings, festivalMeta],
  )

  const availableYears = useMemo(() => {
    const years = [...new Set(festivals.map(f => f.year).filter((y): y is number => y !== null))].sort(
      (a, b) => a - b,
    )
    return years.length > 0 ? years : [new Date().getFullYear()]
  }, [festivals])

  const defaultYear = availableYears[availableYears.length - 1] ?? new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(initialYear ?? defaultYear)
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth)

  const handleYearChange = (year: number) => {
    setSelectedYear(year)
    onYearChange(year)
  }

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    onMonthChange(month)
  }

  const filteredFestivals = useMemo(() => {
    return festivals.filter(f => {
      if (f.year !== selectedYear) return false
      if (selectedMonth !== 'All' && f.month !== MONTHS.indexOf(selectedMonth)) return false
      return true
    })
  }, [festivals, selectedYear, selectedMonth])

  const hasNoFestivals = allFestivalIds.length === 0

  return (
    <div>
      <div className={styles.filters}>
        <div className={styles.years} role="group" aria-label="Filter by year">
          {availableYears.map(year => (
            <button
              key={year}
              type="button"
              className={`chip ${selectedYear === year ? 'active' : ''}`}
              aria-pressed={selectedYear === year}
              onClick={() => handleYearChange(year)}
            >
              {year}
            </button>
          ))}
        </div>
        <select
          className={`form-input ${styles.month}`}
          value={selectedMonth}
          onChange={e => handleMonthChange(e.target.value)}
          aria-label="Filter by month"
        >
          {MONTHS.map(month => (
            <option key={month} value={month}>
              {month === 'All' ? 'All months' : month}
            </option>
          ))}
        </select>
      </div>

      {filteredFestivals.length === 0 ? (
        <div className={styles.empty}>
          <h2 className={`display ${styles.emptyTitle}`}>Nothing in this period.</h2>
          <p className={styles.emptyText}>
            {hasNoFestivals
              ? "You haven't marked any festivals yet."
              : `No festivals in ${selectedMonth !== 'All' ? selectedMonth + ' ' : ''}${selectedYear}.`}
          </p>
          {hasNoFestivals && (
            <button type="button" className="btn btn-primary" onClick={() => router.push('/')}>
              Discover festivals
            </button>
          )}
        </div>
      ) : (
        <div className={styles.cards}>
          {filteredFestivals.map(f => (
            <TimelineCard
              key={f.id}
              festivalId={f.id}
              meta={f.meta!}
              seenArtists={f.seenArtists}
              isUpcoming={f.isUpcoming}
            />
          ))}
        </div>
      )}
    </div>
  )
}
