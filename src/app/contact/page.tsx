import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/legal/LegalPage'
import { TEAM } from '@/lib/site'
import styles from './Contact.module.css'

export const metadata: Metadata = {
  title: 'Contact · Goodraves',
  description: 'Questions, bugs or a festival that’s missing? Email the two people behind Goodraves.',
}

/** Who runs Goodraves and how to reach them. Shares the legal pages' reading layout. */
export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      eyebrow="Get in touch"
      intro="Found a bug, spotted a festival that's missing or wrong, have an idea or a question? Send either of us an email. We run Goodraves in our spare time, so a reply can take a few days."
    >
      <ul className={styles.people}>
        {TEAM.map(person => (
          <li key={person.email} className={styles.person}>
            <span className={styles.name}>{person.name}</span>
            <a href={`mailto:${person.email}`} className={styles.email}>{person.email}</a>
          </li>
        ))}
      </ul>

      <section>
        <h2>Reporting a bug</h2>
        <p>It helps a lot if you include:</p>
        <ul>
          <li>the page or link where it happened;</li>
          <li>what you did, what you expected and what happened instead;</li>
          <li>your device and browser, for example iPhone with Safari;</li>
          <li>a screenshot, if you can.</li>
        </ul>
      </section>

      <section>
        <h2>Wrong or missing festival info</h2>
        <p>
          Send us the festival&apos;s Goodraves link and what&apos;s wrong, ideally with a link to the official line-up or
          timetable.
        </p>
      </section>

      <section>
        <h2>Your data and account</h2>
        <p>
          To get a copy of your data or ask anything about privacy, email either of us. See the{' '}
          <Link href="/privacy">privacy policy</Link> for what we store. You can delete your account yourself under{' '}
          <Link href="/profile">Profile</Link>.
        </p>
      </section>
    </LegalPage>
  )
}
