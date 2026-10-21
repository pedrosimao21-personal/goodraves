import type { ReactNode } from 'react'
import styles from './Auth.module.css'

/**
 * Split screen for log in and register: the brand statement on the left,
 * the form on the right. Mobile stacks them with the form at the bottom.
 * Boards: docs/redesign/boards/Login.dc.html, LoginMobile.dc.html.
 */
export default function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <section className={styles.brand}>
        <h1 className={`display ${styles.statement}`}>
          Every rave you went to.<span className={styles.statementMore}> Every one you will.</span>
        </h1>
        <p className={`mono ${styles.tagline}`}>Track festivals · Rate sets · Follow artists · See where friends go</p>
      </section>
      <section className={styles.formSide}>
        <div className={styles.formBox}>
          <h2 className={`display ${styles.formTitle}`}>{title}</h2>
          {children}
        </div>
      </section>
    </div>
  )
}
