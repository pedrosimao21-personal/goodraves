'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useUserData } from '@/context/UserDataContext'
import { getPopularFestivals } from '@/db/actions/popular-festivals'
import type { PopularFestival, PopularFestivals } from '@/db/actions/popular-festivals-core'
import { PlusIcon, CheckIcon } from '@/components/icons'
import { parseLocalDate } from '@/lib/dates'
import { isFestivalPast } from '@/lib/festival-date'
import styles from './DashboardEmpty.module.css'

const THUMB_SIZE = 112
const MONOGRAM_WORDS = 2
/** First run mixes both, as on the board: mostly history, a couple of plans. */
const FIRST_RUN_PAST = 3
const FIRST_RUN_UPCOMING = 2

type Props = {
  /** Which tab is empty; ignored on first run. */
  isUpcoming: boolean
  /** Nothing on either list yet. */
  isFirstRun: boolean
  userCity: string | null
}

function pickRows(lists: PopularFestivals, isUpcoming: boolean, isFirstRun: boolean) {
  if (isFirstRun) {
    const rows = [...lists.past.festivals.slice(0, FIRST_RUN_PAST), ...lists.upcoming.festivals.slice(0, FIRST_RUN_UPCOMING)]
    return { rows, isNearCity: lists.past.isNearCity && lists.upcoming.isNearCity }
  }
  const list = isUpcoming ? lists.upcoming : lists.past
  return { rows: list.festivals, isNearCity: list.isNearCity }
}

function PopularRow({ festival }: { festival: PopularFestival }) {
  const { isAttended, isUpcoming, toggleFestival } = useUserData()
  const isAdded = isAttended(festival.id) || isUpcoming(festival.id)
  const action = isFestivalPast(festival.date, festival.endDate) ? 'Attended' : 'Going'
  const when = parseLocalDate(festival.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const monogram = festival.name.split(/\s+/).slice(0, MONOGRAM_WORDS).map((word) => word[0]).join('')

  // Full meta: for an admin, upsertFestival rewrites an existing row from it.
  const handleAdd = () => {
    void toggleFestival(festival.id, { ...festival, image: festival.imageUrl })
  }

  return (
    <div className={styles.popularRow}>
      <Link href={`/festival/${festival.id}`} className={styles.popularThumb} tabIndex={-1} aria-hidden="true">
        {festival.imageUrl
          ? <Image src={festival.imageUrl} alt="" width={THUMB_SIZE} height={THUMB_SIZE} sizes="56px" />
          : <span className={`display ${styles.popularMonogram}`}>{monogram}</span>}
      </Link>
      <span className={styles.popularInfo}>
        <Link href={`/festival/${festival.id}`} className={styles.popularName}>{festival.name}</Link>
        <span className={`mono ${styles.popularMeta}`}>{[when, festival.location].filter(Boolean).join(' · ')}</span>
      </span>
      <button type="button" className="btn btn-sm" aria-pressed={isAdded} onClick={handleAdd}>
        {isAdded ? <CheckIcon size={15} strokeWidth={2} /> : <PlusIcon size={15} strokeWidth={2} />}{action}
      </button>
    </div>
  )
}

/** Popular festivals to add in one tap. Board: MyFestivalsEmpty ("Popular near you · tap to add"). */
export default function PopularFestivalList({ isUpcoming, isFirstRun, userCity }: Props) {
  const [lists, setLists] = useState<PopularFestivals | null>(null)

  useEffect(() => {
    let isCancelled = false
    getPopularFestivals(userCity)
      .then((next) => { if (!isCancelled) setLists(next) })
      .catch((err) => {
        // The search above still works; the list just doesn't show.
        console.error('[dashboard] Failed to load popular festivals:', err)
        if (!isCancelled) setLists(null)
      })
    return () => { isCancelled = true }
  }, [userCity])

  if (!lists) return null
  const { rows, isNearCity } = pickRows(lists, isUpcoming, isFirstRun)
  if (rows.length === 0) return null
  const scope = isNearCity && userCity ? `near ${userCity}` : 'on Goodraves'

  return (
    <div>
      <h3 className={`mono ${styles.popularTitle}`}>Popular {scope} · tap to add</h3>
      {rows.map((festival) => <PopularRow key={festival.id} festival={festival} />)}
    </div>
  )
}
