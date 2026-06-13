'use client'

import React, { useMemo, useRef } from 'react'
import { useUserData } from '@/context/UserDataContext'
import { normalizeLocation } from '@/utils/location-normalizer'
import dynamic from 'next/dynamic'
import RaverPassport from '@/components/RaverPassport'

const RaveMap = dynamic(() => import('@/components/RaveMap'), { ssr: false })
const YearBarChart = dynamic(() => import('./InsightsCharts').then(m => ({ default: m.YearBarChart })), { ssr: false })
const GenrePieChart = dynamic(() => import('./InsightsCharts').then(m => ({ default: m.GenrePieChart })), { ssr: false })

export default function Insights() {
  const { attendedFestivals, getFestivalMeta, getArtistSeenCounts, artistMeta, loaded } = useUserData()

  const attendedEvents = useMemo(() => {
    return attendedFestivals.map(id => {
      const meta = getFestivalMeta(id) || {} as any
      return { id, ...meta } as { id: string; date?: string; [key: string]: any }
    }).filter(e => e.date)
  }, [attendedFestivals, getFestivalMeta])

  const chartDataYear = useMemo(() => {
    const counts: Record<string, number> = {}
    attendedEvents.forEach(e => {
      if (!e.date) return
      const year = e.date.substring(0, 4)
      counts[year] = (counts[year] || 0) + 1
    })
    return Object.entries(counts)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year))
  }, [attendedEvents])

  const topGenresData = useMemo(() => {
    const counts: Record<string, number> = {}
    const artistSeenCounts = getArtistSeenCounts()

    Object.entries(artistSeenCounts).forEach(([artistId, { count }]: [string, any]) => {
      const meta = artistMeta[artistId]
      const genres = meta?.genres ?? []
      if (genres.length === 0) return

      genres.slice(0, 4).forEach(genre => {
        counts[genre] = (counts[genre] || 0) + count
      })
    })

    return Object.entries(counts)
      .map(([name, count]: [string, any]) => ({ name, count: count as number }))
      .reduce((acc, curr) => {
        const existing = acc.find(x => x.name.toLowerCase() === curr.name.toLowerCase())
        if (existing) existing.count += curr.count
        else acc.push({ ...curr, name: curr.name.charAt(0).toUpperCase() + curr.name.slice(1) })
        return acc
      }, [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [getArtistSeenCounts, artistMeta])

  const cityData = useMemo(() => {
    const counts: Record<string, number> = {}
    attendedEvents.forEach(e => {
      const location = normalizeLocation(e.location)
      if (!location) return
      counts[location] = (counts[location] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]: [string, any]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [attendedEvents])

  const topArtists = useMemo(() => {
    const counts = getArtistSeenCounts()
    const sorted = Object.entries(counts).sort((a: any, b: any) => b[1].count - a[1].count)
    return sorted.slice(0, 3).map(([id]) => artistMeta[id]?.name || id.replace(/-/g, ' '))
  }, [getArtistSeenCounts, artistMeta])

  const totalArtists = useMemo(() => Object.keys(getArtistSeenCounts()).length, [getArtistSeenCounts])

  const passportRef = useRef(null)
  const passportCaptureRef = useRef(null)

  const handleDownloadPassport = async () => {
    if (!passportCaptureRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const el = passportCaptureRef.current as HTMLElement
      const prevOverflow = el.style.overflow
      el.style.overflow = 'visible'
      const canvas = await html2canvas(el, { backgroundColor: '#000', scale: 3, useCORS: true, logging: false })
      el.style.overflow = prevOverflow
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = 'My_Raver_Passport.png'
      a.click()
    } catch (e) {
      console.error('Failed to generate passport', e)
    }
  }

  if (!loaded) {
    return (
      <div className="page">
        <div className="container" style={{ paddingTop: 32 }}>
          <div style={{ height: 40, width: 200, marginBottom: 24, borderRadius: 8, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 300, borderRadius: 16, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="page fade-in">
      <div className="container" style={{ paddingTop: 32 }}>
        <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: 8 }}>Your Insights</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Deep dive into your raving habits.</p>

        <div style={{ marginBottom: 48 }}>
          <h2 className="section-title">Global Rave Heatmap</h2>
          <div className="dashboard-card" style={{ padding: 0 }}>
            {attendedEvents.length > 0 ? (
              <RaveMap events={attendedEvents} />
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No attended festivals yet!</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, paddingBottom: 64 }}>
          <div className="dashboard-card">
            <h2 className="section-title" style={{ fontSize: '1.25rem', marginBottom: 16 }}>Shows Per Year</h2>
            {chartDataYear.length > 0 ? (
              <YearBarChart data={chartDataYear} />
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No data yet. Mark some past events as attended!</p>
              </div>
            )}
          </div>

          <div className="dashboard-card">
            <h2 className="section-title" style={{ fontSize: '1.25rem', marginBottom: 16 }}>Most Listened Genres</h2>
            {topGenresData.length > 0 ? (
              <GenrePieChart data={topGenresData} />
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No genre data available yet.</p>
              </div>
            )}
          </div>

          <div className="dashboard-card">
            <h2 className="section-title" style={{ fontSize: '1.25rem', marginBottom: 16 }}>Top Cities</h2>
            {cityData.length > 0 ? (
              <div style={{ padding: '8px 0', minHeight: 300 }}>
                {cityData.map((city, index) => (
                  <div key={city.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '12px 16px',
                    marginBottom: 8,
                    background: 'var(--bg-secondary)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 28, height: 28,
                      borderRadius: '50%',
                      background: index === 0 ? 'var(--accent)' : 'var(--bg-glass)',
                      color: index === 0 ? '#fff' : 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.85rem'
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, fontWeight: 600 }}>{city.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {city.count} {city.count === 1 ? 'show' : 'shows'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No city data found.</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ paddingBottom: 64 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.5rem' }}>Your Passport</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>Save a snapshot of your lifetime stats to your phone&apos;s camera roll.</p>
            </div>
            <button className="btn btn-primary" onClick={handleDownloadPassport} style={{ whiteSpace: 'nowrap' }}>
              📸 Save to Phone
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--bg-card)', padding: '32px 16px', borderRadius: 16 }}>
            <div style={{ width: 360, maxWidth: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
              <div style={{ transform: 'scale(min(1, calc((100vw - 64px) / 360)))', transformOrigin: 'top center', flexShrink: 0 }}>
                <RaverPassport
                  ref={passportRef}
                  events={attendedEvents}
                  topArtists={topArtists}
                  topGenre={topGenresData[0]?.name}
                  totalArtists={totalArtists}
                />
              </div>
            </div>
          </div>

          {/* Hidden unscaled passport used exclusively for html2canvas capture */}
          <div style={{ position: 'fixed', top: 0, left: '-9999px', pointerEvents: 'none', zIndex: -1 }}>
            <RaverPassport
              ref={passportCaptureRef}
              events={attendedEvents}
              topArtists={topArtists}
              topGenre={topGenresData[0]?.name}
              totalArtists={totalArtists}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
