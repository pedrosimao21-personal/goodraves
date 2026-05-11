'use client'

import React, { useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUserData } from '@/context/UserDataContext'
import { formatDate } from '@/lib/format-date'

function getEventIcon(eventId: string): string {
  if (eventId.startsWith('ra-')) return '\u{1F3A7}'
  if (eventId.startsWith('custom-')) return '\u{1F3AA}'
  return '\u{1F3B5}'
}

const FestivalRow = React.memo(({ eventId, onRemove, isUpcomingTab, onEdit }: {
  eventId: string
  onRemove: (id: string) => void
  isUpcomingTab: boolean
  onEdit: (id: string) => void
}) => {
  const { getSeenCount, getFestivalMeta } = useUserData()

  const displayEvent = getFestivalMeta(eventId)
  const seenCount = getSeenCount(eventId)

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm('Are you sure you want to remove this festival from your list?')) {
      onRemove(eventId)
    }
  }, [eventId, onRemove])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onEdit(eventId)
  }, [eventId, onEdit])

  return (
    <Link
      href={`/festival/${eventId}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        transition: 'border-color 250ms ease',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {(displayEvent?.image || displayEvent?.imageUrl) ? (
        <Image src={(displayEvent.image || displayEvent.imageUrl)!} alt="" width={44} height={44} style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--gradient-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
          {getEventIcon(eventId)}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.93rem', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
          {displayEvent?.name ?? eventId}
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap', lineHeight: 1.4 }}>
          {displayEvent?.date && <span style={{ whiteSpace: 'nowrap' }}>{formatDate(displayEvent.date)}</span>}
          {displayEvent?.venue && typeof displayEvent.venue === 'object' && displayEvent.venue.city && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{displayEvent.venue.city}</span>
          )}
        </div>
      </div>

      {!isUpcomingTab && seenCount > 0 && (
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{seenCount}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Seen</div>
        </div>
      )}

      <button
        className="btn-ghost"
        onClick={handleEdit}
        title="Edit festival details"
        style={{ fontSize: '0.9rem', color: 'var(--text-muted)', flexShrink: 0, padding: '4px 7px' }}
      >
        &#9998;
      </button>

      <button
        className="btn-ghost"
        style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flexShrink: 0, padding: '4px 7px' }}
        onClick={handleRemove}
        id={`remove-${eventId}`}
        title="Remove from list"
      >
        &times;
      </button>
    </Link>
  )
})

FestivalRow.displayName = 'FestivalRow'

export default FestivalRow
