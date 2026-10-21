'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AddFriendSearch from './AddFriendSearch'
import { FriendList, RequestList } from './FriendLists'
import FriendsFeed from './FriendsFeed'
import { useFriends } from './use-friends'
import styles from './Friends.module.css'

/** Friends. Boards: Friends, FriendsMobile, FriendsEmptyMobile. */
export default function FriendsPage() {
  const { status } = useSession()
  const router = useRouter()
  const { friends, incoming, outgoing, loaded, sendRequest, respond, remove } = useFriends(status === 'authenticated')

  // A redirect belongs in an effect, not the render body: next/navigation's
  // router touches `window` internally, so calling it during render crashes
  // SSR with "location is not defined" once `status` resolves to
  // 'unauthenticated' on the server pass.
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/friends')
    }
  }, [status, router])

  if (status !== 'authenticated' || !loaded) {
    return (
      <div className="page" aria-busy="true" aria-label="Loading your friends">
        <div className="container">
          <div className={`skeleton ${styles.skeletonTitle}`} />
          <div className={`skeleton ${styles.skeletonBlock}`} />
        </div>
      </div>
    )
  }

  const requestCount = incoming.length
  const summary = [
    `${friends.length} friend${friends.length === 1 ? '' : 's'}`,
    requestCount > 0 ? `${requestCount} request${requestCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="page">
      <div className="container">
        <p className={`mono ${styles.eyebrow}`}>{summary}</p>
        <h1 className={`display ${styles.title}`}>Friends</h1>

        <div className={styles.layout}>
          <aside className={styles.aside}>
            <AddFriendSearch onSendRequest={sendRequest} />
            <RequestList incoming={incoming} outgoing={outgoing} onRespond={respond} />
            <FriendList friends={friends} onRemove={remove} />
          </aside>
          <section className={styles.main}>
            <FriendsFeed hasFriends={friends.length > 0} />
          </section>
        </div>
      </div>
    </div>
  )
}
