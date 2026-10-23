import type { ReactNode } from 'react'
import { LEGAL_LAST_UPDATED } from '@/lib/site'
import styles from './Legal.module.css'

/** Reading layout shared by /privacy and /terms. Children are <section>s with an <h2>. */
export default function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <div className="container">
        <article className={styles.article}>
          <p className={`mono ${styles.eyebrow}`}>Last updated {LEGAL_LAST_UPDATED}</p>
          <h1 className={`display ${styles.title}`}>{title}</h1>
          <p className={styles.intro}>{intro}</p>
          {children}
        </article>
      </div>
    </div>
  )
}
