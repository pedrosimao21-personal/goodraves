'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { CloseIcon } from '@/components/icons'
import styles from './Sheet.module.css'

interface SheetProps {
  title: string
  /** Small mono line above the title, e.g. "Admin · festival". */
  eyebrow?: string
  onClose: () => void
  children: ReactNode
}

/** Modal panel: bottom sheet on mobile, centred dialog on desktop. Closes on Escape and scrim click. */
export default function Sheet({ title, eyebrow, onClose, children }: SheetProps) {
  const titleId = useId()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className={styles.scrim}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className={`${styles.panel} fade-in`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.handle} aria-hidden="true"><span /></div>
        <div className={styles.header}>
          <div>
            {eyebrow && <span className={`mono ${styles.eyebrow}`}>{eyebrow}</span>}
            <h2 id={titleId} className={`display ${styles.title}`}>{title}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}

/** Row of footer buttons: first is the cancel, last is the confirming action. */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>
}
