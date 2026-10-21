'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUserData } from '@/context/UserDataContext'
import StatsTabs from '@/components/StatsTabs'
import { useSpotifyEnrichment } from './useSpotifyEnrichment'
import ArtistActionsModal from './ArtistActionsModal'
import DjSuggestionsChips from './DjSuggestionsChips'
import { Podium, RankingRows } from './TopDjsRanking'
import { type RankedArtist, type SortMode, useTopDjsRanking } from './use-top-djs-ranking'
import styles from './TopDjs.module.css'

const TOP_ENRICHMENT_LIMIT = 15
const SKELETON_ROWS = [1, 2, 3, 4, 5]
const SORT_LABELS: Record<SortMode, string> = { count: 'Times seen', rating: 'Your rating' }

function YearSelect({ years, value, onChange }: { years: string[]; value: string; onChange: (year: string) => void }) {
  if (years.length === 0) return null
  return (
    <label className={styles.period}>
      <span className="mono">Period</span>
      <select className={`form-input ${styles.periodSelect}`} value={value} onChange={e => onChange(e.target.value)}>
        <option value="all">All time</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  )
}

/** Stats › Top DJs. Boards: TopDJs, TopDJsMobile. */
export default function TopDJs() {
  const router = useRouter()
  const { artistMeta, performanceRatings, batchEnrichArtists, loaded } = useUserData()
  const [selectedYear, setSelectedYear] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('count')
  const [artistToManage, setArtistToManage] = useState<RankedArtist | null>(null)
  const { ranking, availableYears } = useTopDjsRanking(selectedYear, sortMode)

  const artistNames = useMemo(() => {
    return ranking
      .slice(0, TOP_ENRICHMENT_LIMIT)
      .filter((a) => {
        const meta = artistMeta[a.id]
        return !meta?.genres || meta.genres.length === 0 || !meta?.image
      })
      .map((a) => a.name)
  }, [ranking, artistMeta])

  const spotifyData = useSpotifyEnrichment(artistNames, (results) => {
    const metaUpdates: Record<string, any> = {}
    ranking.slice(0, TOP_ENRICHMENT_LIMIT).forEach((artist) => {
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

  const imageFor = (artist: RankedArtist) => artist.image || spotifyData[artist.name.toLowerCase()]?.image || null
  const totalSets = ranking.reduce((sum, a) => sum + a.count, 0)

  if (!loaded) {
    return (
      <div className="page" aria-busy="true" aria-label="Loading your top DJs">
        <div className="container">
          <StatsTabs active="top-djs" />
          {SKELETON_ROWS.map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <StatsTabs active="top-djs" action={<YearSelect years={availableYears} value={selectedYear} onChange={setSelectedYear} />} />

        {ranking.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={`display ${styles.emptyTitle}`}>No artists tracked yet.</h2>
            <p className={styles.emptyText}>Mark the sets you saw on a festival page and your ranking builds itself.</p>
            <button type="button" className="btn btn-primary" onClick={() => router.push('/')} id="go-discover-djs">
              Discover festivals
            </button>
            <DjSuggestionsChips />
          </div>
        ) : (
          <>
            <div className={styles.controls}>
              <p className={`mono ${styles.summary}`}>
                <span className={styles.summaryNumber}>{ranking.length}</span> unique artists ·{' '}
                <span className={styles.summaryNumber}>{totalSets}</span> sets seen
              </p>
              <div className={styles.seg} role="group" aria-label="Sort by">
                {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={sortMode === mode ? styles.segOn : undefined}
                    aria-pressed={sortMode === mode}
                    onClick={() => setSortMode(mode)}
                  >
                    {SORT_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>
            <Podium ranking={ranking} imageFor={imageFor} onSelectArtist={setArtistToManage} />
            <RankingRows ranking={ranking} imageFor={imageFor} onSelectArtist={setArtistToManage} />
          </>
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
