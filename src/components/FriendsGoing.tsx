import { describeFriendsGoing } from '@/lib/following-display'
import styles from './FriendsGoing.module.css'

const MAX_AVATARS = 3

/** Friends' initials and who is going. Boards: Discover and DiscoverMobile. */
export default function FriendsGoing({ friends }: { friends: string[] }) {
  if (friends.length === 0) return null
  return (
    <span className={styles.friends}>
      <span className={styles.avatars} aria-hidden="true">
        {friends.slice(0, MAX_AVATARS).map((name) => (
          <span key={name} className={`display ${styles.avatar}`}>{name[0]}</span>
        ))}
      </span>
      <span className={`mono ${styles.label}`}>{describeFriendsGoing(friends)}</span>
    </span>
  )
}
