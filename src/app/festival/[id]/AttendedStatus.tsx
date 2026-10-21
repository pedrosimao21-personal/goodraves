'use client'

import { useState } from 'react'
import Sheet from '@/components/Sheet'
import RemoveFestivalSheet from '@/components/RemoveFestivalSheet'
import { CheckIcon, CloseIcon, DotsIcon } from '@/components/icons'
import sheetMenu from '@/components/SheetMenu.module.css'
import styles from './AttendedStatus.module.css'

type Props = {
  eventId: string
  name: string
  seenCount: number
  artistCount: number
  onRemove: () => Promise<unknown>
}

type Step = 'closed' | 'menu' | 'confirm'

const CHECK_SIZE = 14

/**
 * "Attended · saw 5 of 22" in place of the big toggle once you went. Removing
 * the festival sits behind the ⋯ menu and a confirm step, because it also
 * deletes your ratings for it. Board: FestivalAttendedMobile.
 */
export default function AttendedStatus({ eventId, name, seenCount, artistCount, onRemove }: Props) {
  const [step, setStep] = useState<Step>('closed')
  const close = () => setStep('closed')

  return (
    <div className={styles.status}>
      <span className={styles.check} aria-hidden="true"><CheckIcon size={CHECK_SIZE} strokeWidth={3} /></span>
      <span className={styles.label}>
        <strong>Attended</strong>
        {seenCount > 0 && <span className={styles.seen}> · saw {seenCount}{artistCount > 0 ? ` of ${artistCount}` : ''}</span>}
      </span>
      <button
        type="button"
        className={styles.more}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={step === 'menu'}
        onClick={() => setStep('menu')}
      >
        <DotsIcon size={20} />
      </button>

      {step === 'menu' && (
        <Sheet title={name} eyebrow="Your festival" onClose={close}>
          <div className={sheetMenu.list} role="menu">
            <button type="button" role="menuitem" className={`${sheetMenu.item} ${sheetMenu.danger}`} onClick={() => setStep('confirm')}>
              <CloseIcon />
              <span>
                Remove from my festivals
                <span className={sheetMenu.sub}>Also deletes your ratings for it</span>
              </span>
            </button>
          </div>
        </Sheet>
      )}
      {step === 'confirm' && <RemoveFestivalSheet eventId={eventId} name={name} onConfirm={onRemove} onClose={close} />}
    </div>
  )
}
