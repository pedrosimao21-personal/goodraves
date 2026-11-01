import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/legal/LegalPage'
import { CONTACT_EMAIL, TEAM } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Privacy · Goodraves',
  description: 'What Goodraves stores about you, why, who else sees it, and how to get it deleted.',
}

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

/** Privacy policy. Keep in sync with what the app actually stores; bump LEGAL_LAST_UPDATED on change. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="Goodraves is a free, non-commercial hobby project. It stores as little about you as it can, never sells it and runs no ads or tracking."
    >
      <section>
        <h2>Who is responsible</h2>
        <p>
          Goodraves is run by {TEAM.map(person => person.name).join(' and ')}, who are jointly responsible (joint data
          controllers) for the personal data described here. Questions, requests and complaints can go to either of us:
        </p>
        <ul>
          {TEAM.map(person => (
            <li key={person.email}><strong>{person.name}:</strong> <a href={`mailto:${person.email}`}>{person.email}</a></li>
          ))}
        </ul>
      </section>

      <section>
        <h2>What we store</h2>
        <ul>
          <li><strong>Account:</strong> your username, your password (only as a one-way bcrypt hash, never readable) and when you signed up. Your <strong>email address</strong> is required when you create an account and you can change or remove it on your profile. It is used to log in, to reset a forgotten password and to send the confirmation link, and nothing else without your say-so. We don&apos;t ask for your real name or phone number.</li>
          <li><strong>Profile, if you fill it in:</strong> your home city and favourite genres.</li>
          <li><strong>What you do on the site:</strong> festivals you&apos;re going to or went to, your festival and set ratings, notes, comments, artists you follow or want to see, friends and friend requests, and festivals you add yourself.</li>
          <li><strong>Technical data:</strong> your IP address, used to stop password guessing and abuse. We keep it for at most a day. Our hosting provider also keeps short-lived request logs that include IP addresses.</li>
        </ul>
      </section>

      <section>
        <h2>Why, and on what legal basis</h2>
        <ul>
          <li>Your account, profile and activity are needed to run the service you signed up for (performance of a contract, GDPR art. 6(1)(b)).</li>
          <li>IP addresses and logs keep the site secure and working (legitimate interest, GDPR art. 6(1)(f)).</li>
        </ul>
        <p>We don&apos;t use your data for advertising, profiling by third parties or automated decisions about you.</p>
      </section>

      <section>
        <h2>Who can see what</h2>
        <ul>
          <li><strong>Other users</strong> can find you by username to send a friend request.</li>
          <li><strong>Friends</strong> you&apos;ve accepted see your festivals, set ratings, comments and the artists you follow.</li>
          <li><strong>Only you</strong> see your personal notes, home city and genres.</li>
          <li>The two of us running Goodraves can access the database to keep it working and to answer your requests.</li>
        </ul>
      </section>

      <section>
        <h2>Services we use</h2>
        <ul>
          <li><strong>Vercel</strong> hosts the site, running in Frankfurt (EU).</li>
          <li><strong>Neon</strong> hosts the database, in Frankfurt (EU).</li>
          <li><strong>Resend</strong> delivers our emails (confirmation and password-reset links). It receives your email address and the message text when one is sent.</li>
        </ul>
        <p>
          All three are US companies acting as our processors. Where data could reach the US, it&apos;s covered by the EU&ndash;US
          Data Privacy Framework and the European Commission&apos;s standard contractual clauses.
        </p>
        <p>Some features load content straight from other sites, which then see your IP address:</p>
        <ul>
          <li>The map loads its tiles from <strong>OpenStreetMap</strong>.</li>
          <li>Some festival and artist images load from where they&apos;re published, such as Resident Advisor, Partyflock, FestivalFans, Spotify, Last.fm and Wikimedia.</li>
          <li>The <strong>Spotify</strong> player on a festival page only loads when you press &ldquo;Load Spotify player&rdquo;. Spotify can then set its own cookies under <a href="https://www.spotify.com/legal/privacy-policy/" target="_blank" rel="noreferrer">Spotify&apos;s privacy policy</a>.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies and storage</h2>
        <p>
          Goodraves sets one cookie: your login session, which is strictly necessary and expires after 7 days. Your
          theme choice is saved in your browser&apos;s local storage. There are no analytics, advertising or tracking
          cookies, which is why there&apos;s no cookie banner.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Your data stays until you delete your account. Deleting it removes your account and everything linked to it
          straight away. The database provider keeps short-term backups for disaster recovery, which roll over within
          days. IP addresses used for abuse protection are deleted within a day.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>Under the GDPR you can:</p>
        <ul>
          <li>see the data we hold about you, or get a copy you can take elsewhere;</li>
          <li>correct it;</li>
          <li>have it deleted, which you can do yourself under <Link href="/profile">Profile → Delete account</Link>;</li>
          <li>object to or ask us to limit how we use it.</li>
        </ul>
        <p>
          For anything you can&apos;t do in the app, email {mail} and you&apos;ll get an answer within a month. You can
          also complain to your data protection authority. In the Netherlands that&apos;s the{' '}
          <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noreferrer">Autoriteit Persoonsgegevens</a>.
        </p>
      </section>

      <section>
        <h2>Age</h2>
        <p>Goodraves is for people aged 16 and over. If you&apos;re younger, please don&apos;t create an account.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If this policy changes, the date at the top changes too. Big changes will also be announced on the site.</p>
      </section>
    </LegalPage>
  )
}
