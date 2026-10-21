'use client'

import YourNextStrip from './YourNextStrip'
import FriendsGoingRow from './FriendsGoingRow'
import styles from './DiscoverHome.module.css'

/**
 * What Discover shows on a phone before a search: your next festival and
 * where friends are going. The desktop board has neither, so CSS hides it
 * there. Board: DiscoverMobile.
 */
export default function DiscoverHome() {
  return (
    <div className={styles.home}>
      <YourNextStrip />
      <FriendsGoingRow />
    </div>
  )
}
