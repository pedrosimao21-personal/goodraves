'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUserData } from '@/context/UserDataContext'
import { useSpotifyEnrichment } from './useSpotifyEnrichment'
import ArtistActionsModal from './ArtistActionsModal'
import { PageHeader, StatsBar, ArtistRankingList } from './TopDjsSections'

const TOP_ENRICHMENT_LIMIT = 15

export default function TopDJs() {
  const router = useRouter()
  const { getArtistSeenCounts, artistMeta, performanceRatings, getFestivalMeta, batchEnrichArtists, loaded } = useUserData()
  const [selectedYear, setSelectedYear] = useState('all')
  const [artistToManage, setArtistToManage] = useState(null)

  const { ranking, availableYears } = useMemo(() => {
    const counts = getArtistSeenCounts()
    const years = new Set<string>()

    const list = Object.entries(counts)
      .map(([artistId, { count, events }]: [string, any]) => {
        const meta = artistMeta[artistId]
        const festivals = events.map((eid: string) => {
          const fm = getFestivalMeta(eid)
          return { id: eid, name: fm?.name ?? eid, date: fm?.date ?? null }
        })

        festivals.forEach((f: any) => { if (f.date) years.add(f.date.substring(0, 4)) })

        const filtered = selectedYear === 'all'
          ? festivals
          : festivals.filter((f: any) => f.date?.startsWith(selectedYear))

        if (filtered.length === 0) return null

        const ratings = filtered.map((f: any) => performanceRatings[`${f.id}::${artistId}`]).filter((r: number) => r > 0)
        const avgSetRating = ratings.length > 0
          ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
          : 0

        return {
          id: artistId,
          name: meta?.name ?? artistId,
          image: meta?.image ?? null,
          count: filtered.length,
          avgSetRating,
          festivals: filtered.sort((a: any, b: any) => (a.date || '').localeCompare(b.date || '')),
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (b.count !== a.count) return b.count - a.count
        if (b.avgSetRating !== a.avgSetRating) return b.avgSetRating - a.avgSetRating
        return a.name.localeCompare(b.name)
      })

    return {
      ranking: list,
      availableYears: [...years].sort((a: any, b: any) => b.localeCompare(a)),
    }
  }, [getArtistSeenCounts, artistMeta, performanceRatings, getFestivalMeta, selectedYear])

  const artistNames = useMemo(() => {
    return ranking
      .slice(0, TOP_ENRICHMENT_LIMIT)
      .filter((a: any) => {
        const meta = artistMeta[a.id]
        return !meta?.genres || meta.genres.length === 0 || !meta?.image
      })
      .map((a: any) => a.name)
  }, [ranking, artistMeta])

  const spotifyData = useSpotifyEnrichment(artistNames, (results) => {
    const metaUpdates: Record<string, any> = {}
    ranking.slice(0, TOP_ENRICHMENT_LIMIT).forEach((artist: any) => {
      const enriched = results[artist.name.toLowerCase()]
      if (!enriched) return

      const hasNewGenres = enriched.genres && enriched.genres.length > 0
      const hasExistingGenres = (artistMeta[artist.id]?.genres ?? []).length > 0

      if (hasNewGenres || !hasExistingGenres) {
        metaUpdates[artist.id] = {
          name: enriched.name || artist.name,
          image: enriched.image || artist.image,
          genres: hasNewGenres ? enriched.genres : (artistMeta[artist.id]?.genres || []),
        }
      }
    })
    if (Object.keys(metaUpdates).length > 0) {
      batchEnrichArtists(metaUpdates)
    }
  })

  if (!loaded) {
    return (
      <div className="page">
        <div className="container" style={{ paddingTop: 32 }}>
          <div style={{ height: 40, width: 200, marginBottom: 24, borderRadius: 8, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 82, borderRadius: 14, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <PageHeader
          availableYears={availableYears}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
        />

        {ranking.length > 0 && <StatsBar ranking={ranking} />}

        {ranking.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#127908;</div>
            <h3>No artists tracked yet</h3>
            <p>Go to a festival page and mark artists you&apos;ve seen to start building your ranking.</p>
            <button className="btn btn-primary" onClick={() => router.push('/')} id="go-discover-djs">
              Discover Festivals
            </button>
          </div>
        ) : (
          <ArtistRankingList
            ranking={ranking}
            spotifyData={spotifyData}
            artistMeta={artistMeta}
            onSelectArtist={setArtistToManage}
          />
        )}

        {ranking.length > 0 && (
          <div style={{ marginTop: 24, padding: '0 4px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Click an artist to see history or go to profile
          </div>
        )}

        <ArtistActionsModal
          artist={artistToManage}
          onClose={() => setArtistToManage(null)}
          performanceRatings={performanceRatings}
        />
      </div>
    </div>
  )
}
