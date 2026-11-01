'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import UserAvatar from '@/components/UserAvatar'
import { formatDateRange } from '@/lib/format-date'
import { CityField, GenresField, PrivacyField, ThemeField } from './ProfileFields'
import { AccountField, PasswordField } from './AccountFields'
import { AvatarField } from './AvatarField'
import { EmailField } from './EmailField'
import { NotificationsField } from './NotificationsField'
import type { TailoredFestival } from '@/db/actions/tailored-festivals-core'
import { parseGenres, useProfile } from './use-profile'
import styles from './Profile.module.css'

const THUMB_SIZE = 96
const GENRES_IN_LABEL = 2

/** "Techno and house near Rotterdam", from the profile's genres and the city match. */
function describeTailored(genreList: string[], city: string, isNearCity: boolean): string {
  const shown = genreList.slice(0, GENRES_IN_LABEL).map((genre, index) => (index === 0 ? genre : genre.toLowerCase()))
  const genresText = shown.join(' and ')
  return isNearCity && city ? `${genresText} near ${city}` : genresText
}

function TailoredRow({ fest }: { fest: TailoredFestival }) {
  return (
    <Link href={`/festival/${fest.id}`} className={styles.tailoredRow}>
      <span className={styles.thumb}>
        {fest.imageUrl && <Image src={fest.imageUrl} alt="" width={THUMB_SIZE} height={THUMB_SIZE} sizes="48px" />}
      </span>
      <span className={styles.tailoredInfo}>
        <span className={styles.tailoredName}>{fest.name}</span>
        <span className={`mono ${styles.muted}`}>{[formatDateRange(fest.date, fest.endDate), fest.location || fest.venue].filter(Boolean).join(' · ')}</span>
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
  const tailoredFor = genreList.length > 0 ? describeTailored(genreList, city, tailored.isNearCity) : ''

  return (
    <div className="page">
      <div className="container">
        <div className={styles.identity}>
          <UserAvatar className={`display ${styles.avatar}`} name={name} avatarUrl={session.user?.image} size={88} />
          <div>
            <h1 className={`display ${styles.name}`}>{name}</h1>
            {session.user?.email && <p className={`mono ${styles.muted}`}>{session.user.email}</p>}
          </div>
        </div>

        <div className={styles.layout}>
          <section className={styles.fields}>
            <AvatarField />
            <CityField key={city} value={city} onSave={saveCity} />
            <GenresField value={genres} onSave={saveGenres} />
            <ThemeField />
            <PrivacyField />
            <EmailField />
            <NotificationsField />
            <PasswordField />
            <AccountField />
          </section>

          <aside className={styles.aside}>
            <div className={styles.asideHeader}>
              <h2 className={`display ${styles.asideTitle}`}>Tailored for you</h2>
              {tailoredFor && <p className={`mono ${styles.muted}`}>{tailoredFor}</p>}
            </div>
            {tailoredLoading && <p className={styles.note}>Finding festivals for you…</p>}
            {!tailoredLoading && tailored.festivals.map(fest => <TailoredRow key={fest.id} fest={fest} />)}
            {!tailoredLoading && tailored.festivals.length === 0 && (
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
