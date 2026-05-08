'use client'

import React, { useMemo, useRef } from 'react'
import { useUserData } from '@/context/UserDataContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts'
import dynamic from 'next/dynamic'
import RaverPassport from '@/components/RaverPassport'

const RaveMap = dynamic(() => import('@/components/RaveMap'), { ssr: false })

export default function Insights() {
  const { attendedFestivals, getFestivalMeta, getArtistSeenCounts, artistMeta, loaded } = useUserData()

  const attendedEvents = useMemo(() => {
    return attendedFestivals.map(id => {
      const meta = getFestivalMeta(id) || {} as any
      return { id, ...meta } as { id: string; date?: string; [key: string]: any }
    }).filter(e => e.date)
  }, [attendedFestivals, getFestivalMeta])

  const chartDataYear = useMemo(() => {
    const counts = {}
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
    const GENRE_MAP = {
      'techno': 'techno', 'berlin techno': 'techno', 'amsterdam techno': 'techno',
      'minimal techno': 'techno', 'acid techno': 'techno', 'industrial techno': 'techno',
      'hard techno': 'techno', 'detroit techno': 'techno', 'dark techno': 'techno',
      'uk techno': 'techno', 'dub techno': 'techno', 'raw techno': 'techno',
      'schranz': 'techno', 'peak time techno': 'techno', 'melodic techno': 'melodic techno & house',
      'house': 'house', 'deep house': 'house', 'tech house': 'house',
      'afro house': 'house', 'minimal house': 'house', 'chicago house': 'house',
      'soulful house': 'house', 'vocal house': 'house', 'organic house': 'house',
      'micro house': 'house', 'microhouse': 'house', 'nu house': 'house',
      'french house': 'house', 'dutch house': 'house', 'funky house': 'house',
      'minimal': 'house', 'minimal deep tech': 'house',
      'melodic techno and house': 'melodic techno & house',
      'melodic techno & house': 'melodic techno & house',
      'progressive house': 'melodic techno & house', 'melodic house': 'melodic techno & house',
      'afterhours': 'melodic techno & house',
      'trance': 'trance', 'progressive trance': 'trance', 'psytrance': 'trance',
      'goa trance': 'trance', 'uplifting trance': 'trance', 'tech trance': 'trance',
      'electronic': 'electronic', 'electronica': 'electronic', 'idm': 'electronic',
      'ambient': 'electronic', 'experimental': 'electronic', 'modular synth': 'electronic',
      'electro': 'electronic', 'electro music': 'electronic',
      'braindance': 'electronic', 'glitch': 'electronic',
      'drum and bass': 'drum & bass', 'drum & bass': 'drum & bass',
      'jungle': 'drum & bass', 'neurofunk': 'drum & bass', 'liquid funk': 'drum & bass',
      'd&b': 'drum & bass', 'dnb': 'drum & bass',
      'breakbeat': 'breaks', 'breaks': 'breaks', 'break': 'breaks',
      'nu-skool breaks': 'breaks',
      'disco': 'disco', 'nu disco': 'disco', 'disco house': 'disco',
      'funk': 'disco', 'funk carioca': 'disco',
      'hip hop': 'hip-hop', 'rap': 'hip-hop', 'trap': 'hip-hop',
      'ebm': 'industrial', 'industrial': 'industrial', 'dark electro': 'industrial',
      'post-industrial': 'industrial',
      'noise': 'experimental', 'power electronics': 'experimental',
      'uk garage': 'garage & bass', 'bassline': 'garage & bass', 'speed garage': 'garage & bass',
      'grime': 'garage & bass', 'bass music': 'garage & bass', 'footwork': 'garage & bass',
    }

    const BLACKLIST = new Set([
      'dj', 'dj music', 'swedish', 'dancehall', 'rave', 'club', 'filter house',
      'dutch', 'german', 'uk', 'belgian', 'french', 'belgian edm',
    ])

    const counts = {}
    const artistSeenCounts = getArtistSeenCounts()

    Object.entries(artistSeenCounts).forEach(([artistId, { count }]: [string, any]) => {
      const meta = artistMeta[artistId]
      const genres = meta?.genres ?? []
      if (genres.length === 0) return

      const mapped = new Set()
      genres.slice(0, 4).forEach(raw => {
        const lower = raw.toLowerCase().trim()
        if (BLACKLIST.has(lower)) return
        const canonical = GENRE_MAP[lower] || raw
        mapped.add(canonical)
      })

      mapped.forEach((genre: string) => {
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
    const counts = {}
    attendedEvents.forEach(e => {
      const city = e.venue?.city || 'Unknown'
      if (city === 'Unknown') return
      counts[city] = (counts[city] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]: [string, any]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [attendedEvents])

  const topArtistName = useMemo(() => {
    const counts = getArtistSeenCounts()
    const sorted = Object.entries(counts).sort((a: any, b: any) => b[1].count - a[1].count)
    if (sorted.length === 0) return null
    const topId = sorted[0][0]
    return artistMeta[topId]?.name || topId.replace(/-/g, ' ')
  }, [getArtistSeenCounts, artistMeta])

  const totalArtists = useMemo(() => Object.keys(getArtistSeenCounts()).length, [getArtistSeenCounts])

  const passportRef = useRef(null)

  const handleDownloadPassport = async () => {
    if (!passportRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(passportRef.current, { backgroundColor: '#000', scale: 2 })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = 'My_Raver_Passport.png'
      a.click()
    } catch (e) {
      console.error('Failed to generate passport', e)
    }
  }

  const COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#fb7185', '#2dd4bf', '#a78bfa']

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
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataYear}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="year" stroke="#888" tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8 }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                      {chartDataYear.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={'#8b5cf6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No data yet. Mark some past events as attended!</p>
              </div>
            )}
          </div>

          <div className="dashboard-card">
            <h2 className="section-title" style={{ fontSize: '1.25rem', marginBottom: 16 }}>Most Listened Genres</h2>
            {topGenresData.length > 0 ? (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topGenresData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="count"
                      stroke="none"
                    >
                      {topGenresData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8, padding: '8px 12px' }}
                      itemStyle={{ color: '#fff', fontSize: '0.9rem' }}
                      formatter={(value, name) => [`${value} Performance${value > 1 ? 's' : ''}`, name]}
                    />
                    <Legend verticalAlign="bottom" height={48} iconType="circle" wrapperStyle={{ fontSize: '0.75rem', color: '#ccc', textTransform: 'capitalize' }}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
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
          <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--bg-card)', padding: '32px 16px', borderRadius: 16, overflowX: 'auto' }}>
            <RaverPassport
              ref={passportRef}
              events={attendedEvents}
              topArtistName={topArtistName}
              topGenre={topGenresData[0]?.name}
              totalArtists={totalArtists}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
