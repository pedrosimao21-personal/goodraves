'use client'

import type { FriendEntry } from '@/db/actions/friends'
import { CloseIcon } from '@/components/icons'
import styles from './Friends.module.css'

function Avatar({ name }: { name: string }) {
  return <span className={`display ${styles.avatar}`} aria-hidden="true">{name[0]}</span>
}

function ListHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className={styles.listHeader}>
      <h2 className={`display ${styles.listTitle}`}>{title}</h2>
      <span className={`mono ${styles.muted}`}>{count}</span>
    </div>
  )
}

/** Incoming requests to accept or decline, then the ones you sent. Board: Friends. */
export function RequestList({ incoming, outgoing, onRespond }: {
  incoming: FriendEntry[]
  outgoing: FriendEntry[]
  onRespond: (requesterId: string, accept: boolean) => void
}) {
  if (incoming.length + outgoing.length === 0) return null
  return (
    <section>
      <ListHeader title="Requests" count={incoming.length + outgoing.length} />
      {incoming.map(req => (
        <div key={req.id} className={styles.person}>
          <Avatar name={req.username} />
          <span className={styles.personName}>{req.username}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onRespond(req.id, true)}>Accept</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRespond(req.id, false)}>Decline</button>
        </div>
      ))}
      {outgoing.map(req => (
        <div key={req.id} className={styles.person}>
          <Avatar name={req.username} />
          <span className={styles.personName}>{req.username}</span>
          <span className={`mono ${styles.muted}`}>Sent · pending</span>
        </div>
      ))}
    </section>
  )
}

export function FriendList({ friends, onRemove }: { friends: FriendEntry[]; onRemove: (id: string) => void }) {
  return (
    <section>
      <ListHeader title="Your friends" count={friends.length} />
      {friends.length === 0 && <p className={styles.empty}>No friends yet. Add one by username above.</p>}
      {friends.map(friend => (
        <div key={friend.id} className={styles.person}>
          <Avatar name={friend.username} />
          <span className={styles.personName}>{friend.username}</span>
          <button type="button" className={styles.removeButton} onClick={() => onRemove(friend.id)} aria-label={`Remove ${friend.username}`} title="Remove friend">
            <CloseIcon size={16} />
          </button>
        </div>
      ))}
    </section>
  )
}
