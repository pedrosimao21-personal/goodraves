'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateArtistByName, type ArtistData } from '@/db/actions/artists'
import { useUserData } from '@/context/UserDataContext'
import { MAX_NOTES_LENGTH } from '@/lib/constants'
import { SimilarArtistCard } from './SimilarArtistCard'
import SectionHeading from './SectionHeading'
import styles from './ArtistBody.module.css'

const BIO_PREVIEW_PARAGRAPHS = 2
const NOTES_ROWS = 3

type CreatedArtist = { id: string; name: string }

function toArtistUrl(artist: CreatedArtist): string {
  return `/artist/${artist.id}/${encodeURIComponent(artist.name)}`
}

/** Resolves each similar artist to its /artist URL, so the cards can be plain links. */
function useSimilarUrls(similar: ArtistData['lastfmSimilar'] | undefined) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!similar?.length) return
    let cancelled = false
    const unresolved = similar.filter(a => !urls.has(a.name))
    if (!unresolved.length) return
    Promise.all(
      unresolved.map(a =>
        (getOrCreateArtistByName(a.name) as unknown as Promise<CreatedArtist>)
          .then(r => ({ key: a.name, url: toArtistUrl(r) }))
          .catch(() => null)
      )
    ).then(results => {
      if (cancelled) return
      setUrls(prev => {
        const next = new Map(prev)
        results.forEach(r => { if (r) next.set(r.key, r.url) })
        return next
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [similar])

  return urls
}

function About({ bio }: { bio: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const paragraphs = bio.split('\n').filter(Boolean)
  const visible = isExpanded ? paragraphs : paragraphs.slice(0, BIO_PREVIEW_PARAGRAPHS)
  return (
    <section>
      <SectionHeading title="About" meta="Last.fm" size="sm" />
      <div className={styles.bio}>
        {visible.map((para, i) => <p key={i}>{para}</p>)}
      </div>
      {paragraphs.length > BIO_PREVIEW_PARAGRAPHS && (
        <button type="button" className={`mono ${styles.textButton}`} onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </section>
  )
}

interface ArtistAsideProps {
  artistId: string
  artist: ArtistData | null
  refreshing: boolean
  reportSent: boolean
  onReportWrongData: () => void
}

/** Right column on desktop: bio, your notes, similar artists, report link. Board: Artist. */
export default function ArtistAside({ artistId, artist, refreshing, reportSent, onReportWrongData }: ArtistAsideProps) {
  const router = useRouter()
  const { getNotes, setNotes } = useUserData()
  const similarUrls = useSimilarUrls(artist?.lastfmSimilar)

  async function navigateToSimilar(name: string) {
    const result = await (getOrCreateArtistByName(name) as unknown as Promise<CreatedArtist>)
    router.push(toArtistUrl(result))
  }

  return (
    <aside className={styles.aside}>
      {artist?.lastfmBio && <About bio={artist.lastfmBio} />}

      <div>
        <label className={`mono ${styles.label}`} htmlFor="artist-notes">Your notes</label>
        <textarea
          id="artist-notes"
          className="form-input"
          placeholder="What do you want to remember about this artist?"
          value={getNotes(artistId)}
          onChange={(e) => setNotes(artistId, e.target.value)}
          rows={NOTES_ROWS}
          maxLength={MAX_NOTES_LENGTH}
        />
      </div>

      {(artist?.lastfmSimilar?.length ?? 0) > 0 && (
        <section>
          <SectionHeading title="Similar artists" size="sm" />
          <div className={styles.similarGrid}>
            {artist!.lastfmSimilar.map(a => (
              <SimilarArtistCard
                key={a.name}
                artistName={a.name}
                image={a.image}
                href={similarUrls.get(a.name)}
                onClick={() => navigateToSimilar(a.name)}
              />
            ))}
          </div>
        </section>
      )}

      {artist && (
        <div className={styles.report}>
          {refreshing && <p className={`mono ${styles.muted}`}>Refreshing data…</p>}
          {reportSent ? (
            <p className={styles.muted}>Cache cleared, reloading fresh data.</p>
          ) : (
            <button type="button" className={`mono ${styles.textButton}`} onClick={onReportWrongData} disabled={refreshing}>
              Report wrong info
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
