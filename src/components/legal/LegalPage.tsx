import type { ReactNode } from 'react'
import { LEGAL_LAST_UPDATED } from '@/lib/site'
import styles from './Legal.module.css'

type Props = {
  title: string
  intro: ReactNode
  /** Mono line above the title; defaults to the legal pages' last-updated date. */
  eyebrow?: string
  children: ReactNode
}

/** Reading layout shared by /privacy, /terms and /contact. Children are <section>s with an <h2>. */
export default function LegalPage({ title, intro, eyebrow = `Last updated ${LEGAL_LAST_UPDATED}`, children }: Props) {
  return (
    <div className="page">
      <div className="container">
        <article className={styles.article}>
          <p className={`mono ${styles.eyebrow}`}>{eyebrow}</p>
          <h1 className={`display ${styles.title}`}>{title}</h1>
          <p className={styles.intro}>{intro}</p>
          {children}
        </article>
      </div>
    </div>
  )
}
