'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatDate } from '@/lib/format-date'
import { AccountField, CityField, GenresField, PrivacyField, ThemeField } from './ProfileFields'
import { parseGenres, useProfile, type TailoredFestival } from './use-profile'
import styles from './Profile.module.css'

const THUMB_SIZE = 96

function TailoredRow({ fest }: { fest: TailoredFestival }) {
  return (
    <Link href={`/festival/${fest.id}`} className={styles.tailoredRow}>
      <span className={styles.thumb}>
        {fest.imageUrl && <Image src={fest.imageUrl} alt="" width={THUMB_SIZE} height={THUMB_SIZE} sizes="48px" />}
      </span>
      <span className={styles.tailoredInfo}>
        <span className={styles.tailoredName}>{fest.name}</span>
        <span className={`mono ${styles.muted}`}>{[fest.date ? formatDate(fest.date) : null, fest.location || fest.venue].filter(Boolean).join(' · ')}</span>
      </span>
    </Link>
  )
}

/** Profile. Boards: Profile, ProfileMobile. */
export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { city, genres, tailored, tailoredLoading, saveCity, saveGenres } = useProfile(status === 'authenticated')

  // A redirect belongs in an effect, not the render body: next/navigation's
  // router touches `window` internally, so calling it during render crashes
  // SSR with "location is not defined" once `status` resolves to
  // 'unauthenticated' on the server pass.
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  if (status !== 'authenticated' || !session) {
    return (
      <div className="page" aria-busy="true" aria-label="Loading your profile">
        <div className="container">
          <div className={`skeleton ${styles.skeleton}`} />
        </div>
      </div>
    )
  }

  const name = session.user?.name ?? ''
  const genreList = parseGenres(genres)
  // The search matches festivals by the first genre only, not by city.
  const tailoredFor = genreList[0] ? `Matching ${genreList[0]}` : ''

  return (
    <div className="page">
      <div className="container">
        <div className={styles.identity}>
          <span className={`display ${styles.avatar}`} aria-hidden="true">{name[0] || 'U'}</span>
          <div>
            <h1 className={`display ${styles.name}`}>{name}</h1>
            {session.user?.email && <p className={`mono ${styles.muted}`}>{session.user.email}</p>}
          </div>
        </div>

        <div className={styles.layout}>
          <section className={styles.fields}>
            <CityField key={city} value={city} onSave={saveCity} />
            <GenresField value={genres} onSave={saveGenres} />
            <ThemeField />
            <PrivacyField />
            <AccountField />
          </section>

          <aside className={styles.aside}>
            <div className={styles.asideHeader}>
              <h2 className={`display ${styles.asideTitle}`}>Tailored for you</h2>
              {tailoredFor && <p className={`mono ${styles.muted}`}>{tailoredFor}</p>}
            </div>
            {tailoredLoading && <p className={styles.note}>Finding festivals for {genreList[0]}…</p>}
            {!tailoredLoading && tailored.map(fest => <TailoredRow key={fest.id} fest={fest} />)}
            {!tailoredLoading && tailored.length === 0 && (
              <p className={styles.note}>
                {genreList.length > 0
                  ? 'No festivals match your favourite genres right now.'
                  : 'Add a favourite genre and festivals that match show up here.'}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
