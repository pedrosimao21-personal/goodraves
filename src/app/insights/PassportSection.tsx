'use client'

import { useMemo, useRef, useState } from 'react'
import { useUserData } from '@/context/UserDataContext'
import RaverPassport from '@/components/RaverPassport'
import { DownloadIcon } from '@/components/icons'
import type { AttendedEvent } from './use-insights-data'
import styles from './Insights.module.css'

const GENRES_PER_ARTIST = 4
const TOP_ARTIST_COUNT = 5
const CAPTURE_SCALE = 3

/** "Raver passport": pick a period and save the card as an image. Board: Insights. */
export default function PassportSection({ attendedEvents }: { attendedEvents: AttendedEvent[] }) {
  const { getArtistSeenCounts, artistMeta } = useUserData()
  const [passportYear, setPassportYear] = useState('all')
  const [saveFailed, setSaveFailed] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null)

  const years = useMemo(() => {
    return [...new Set(attendedEvents.map(e => e.date!.substring(0, 4)))].sort((a, b) => b.localeCompare(a))
  }, [attendedEvents])

  const events = useMemo(() => {
    if (passportYear === 'all') return attendedEvents
    return attendedEvents.filter(e => e.date!.startsWith(passportYear))
  }, [attendedEvents, passportYear])

  // Artist counts scoped to the period: each entry's `events` list (from
  // getArtistSeenCounts) is filtered to the period's festival ids.
  const stats = useMemo(() => {
    const periodIds = new Set(events.map(e => e.id))
    const scoped = Object.entries(getArtistSeenCounts())
      .map(([artistId, { events: seenAt }]: [string, any]) => ({
        artistId,
        count: seenAt.filter((eid: string) => periodIds.has(eid)).length,
      }))
      .filter(a => a.count > 0)
      .sort((a, b) => b.count - a.count)

    const genreCounts: Record<string, number> = {}
    scoped.forEach(({ artistId, count }) => {
      const genres: string[] = artistMeta[artistId]?.genres ?? []
      genres.slice(0, GENRES_PER_ARTIST).forEach(genre => {
        const key = genre.toLowerCase()
        genreCounts[key] = (genreCounts[key] || 0) + count
      })
    })
    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

    return {
      topArtists: scoped.slice(0, TOP_ARTIST_COUNT).map(({ artistId }) => artistMeta[artistId]?.name || artistId.replace(/-/g, ' ')),
      totalArtists: scoped.length,
      topGenre: topGenre ? topGenre.charAt(0).toUpperCase() + topGenre.slice(1) : undefined,
    }
  }, [events, getArtistSeenCounts, artistMeta])

  const handleSave = async () => {
    if (!captureRef.current) return
    setSaveFailed(false)
    try {
      const html2canvas = (await import('html2canvas')).default
      // The card has its own fixed colours, so the canvas fill is fixed too.
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#f2f0ea', scale: CAPTURE_SCALE, useCORS: true, logging: false })
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = 'My_Raver_Passport.png'
      link.click()
    } catch (err) {
      console.error('Failed to generate passport', err)
      setSaveFailed(true)
    }
  }

  const periodLabel = passportYear === 'all' ? 'All time' : passportYear
  const cardProps = { events, periodLabel, ...stats }

  return (
    <section className={styles.passport}>
      <div className={styles.passportIntro}>
        <h2 className={`display ${styles.passportTitle}`}>Raver passport</h2>
        <p className={styles.muted}>A shareable card of your year. Pick a period, then save it as an image.</p>
        <div className={styles.passportActions}>
          {years.length > 0 && (
            <select className={`form-input ${styles.select}`} value={passportYear} onChange={e => setPassportYear(e.target.value)} aria-label="Passport period">
              <option value="all">All time</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            <DownloadIcon size={16} strokeWidth={2} />Save image
          </button>
        </div>
        {saveFailed && <p className="form-error">Could not create the image. Try again.</p>}
      </div>
      <div className={styles.passportPreview}>
        <RaverPassport {...cardProps} />
      </div>
      {/* Unscaled copy off-screen, used only for the image capture. */}
      <div className={styles.captureHost} aria-hidden="true">
        <RaverPassport ref={captureRef} {...cardProps} />
      </div>
    </section>
  )
}
