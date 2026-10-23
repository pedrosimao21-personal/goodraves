import Link from 'next/link'
import styles from './SiteFooter.module.css'

/** Legal links and the no-affiliation line, under every page. */
export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <nav className={`mono ${styles.links}`} aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <p className={styles.note}>
          A non-commercial hobby project. Not affiliated with any festival or with Resident Advisor, Partyflock,
          FestivalFans, Spotify or Last.fm.
        </p>
      </div>
    </footer>
  )
}
