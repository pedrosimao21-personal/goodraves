import type { ReactNode } from 'react'
import styles from './PageMessage.module.css'

type Props = {
  eyebrow?: string
  title: string
  text: ReactNode
  /** Buttons or links under the text; the first one should be the primary action. */
  children?: ReactNode
  isAlert?: boolean
}

/**
 * Full-page message for not-found and error states: one display line, one
 * sentence, one primary action. Follows the States boards' empty-result type.
 */
export default function PageMessage({ eyebrow, title, text, children, isAlert = false }: Props) {
  return (
    <div className="page">
      <div className="container">
        <div className={styles.message} role={isAlert ? 'alert' : undefined}>
          {eyebrow && <p className={`mono ${styles.eyebrow}`}>{eyebrow}</p>}
          <h1 className={`display ${styles.title}`}>{title}</h1>
          <p className={styles.text}>{text}</p>
          {children && <div className={styles.actions}>{children}</div>}
        </div>
      </div>
    </div>
  )
}
