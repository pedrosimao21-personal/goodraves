'use client'

import { useUserData } from '@/context/UserDataContext'
import FestivalNotes from './FestivalNotes'
import styles from './FestivalYourNight.module.css'

const VIBE_MAX = 5
const PUBLIC_COMMENT_ROWS = 2

/** Five full-width bars; tapping the current value clears it. */
function VibeRating({ eventId, rating, onRate }: { eventId: string; rating: number; onRate: (id: string, r: number) => void }) {
  return (
    <div>
      <div className={styles.vibeHeader}>
        <span className={`mono ${styles.label}`} id="vibe-rating-label">Vibe rating</span>
        <span className="mono">{rating > 0 ? `${rating} / ${VIBE_MAX}` : 'Not rated'}</span>
      </div>
      <div className={styles.vibeBars} role="group" aria-labelledby="vibe-rating-label">
        {Array.from({ length: VIBE_MAX }, (_, i) => {
          const value = i + 1
          return (
            <button
              key={value}
              type="button"
              className={`${styles.vibeBar} ${value <= rating ? styles.vibeBarOn : ''}`}
              aria-label={`Rate ${value} of ${VIBE_MAX}`}
              aria-pressed={value === rating}
              onClick={() => onRate(eventId, value === rating ? 0 : value)}
            />
          )
        })}
      </div>
    </div>
  )
}

/** The attended state's personal block: vibe, notes and the public comment. Board: FestivalAttendedMobile. */
export default function FestivalYourNight({ eventId }: { eventId: string }) {
  const {
    getFestivalRating, setFestivalRating, getFestivalNotes, setFestivalNotes,
    getFestivalPublicComment, setFestivalPublicComment,
  } = useUserData()

  return (
    <section className={styles.panel}>
      <h2 className={`display ${styles.title}`}>Your night</h2>
      <div className={styles.fields}>
        <VibeRating eventId={eventId} rating={getFestivalRating(eventId)} onRate={setFestivalRating} />
        <FestivalNotes
          eventId={eventId}
          notes={getFestivalNotes(eventId)}
          onSave={setFestivalNotes}
          label="Personal notes · only you"
          placeholder="What do you want to remember about this one?"
        />
        <FestivalNotes
          eventId={eventId}
          notes={getFestivalPublicComment(eventId)}
          onSave={setFestivalPublicComment}
          label="Comment · friends see this"
          placeholder="What should your friends know?"
          rows={PUBLIC_COMMENT_ROWS}
        />
      </div>
    </section>
  )
}
