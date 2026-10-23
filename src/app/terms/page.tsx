import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/legal/LegalPage'
import { CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms · Goodraves',
  description: 'The rules for using Goodraves.',
}

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

/** Terms of use. Bump LEGAL_LAST_UPDATED on change. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      intro="Goodraves is a free, non-commercial hobby project for keeping track of festivals and raves. By using it, you agree to these terms."
    >
      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be 16 or older.</li>
          <li>One account per person. Keep your password to yourself.</li>
          <li>Goodraves doesn&apos;t store your email address, so it can&apos;t send you a reset link. If you lose your password, email {mail} from an address you can prove is yours, and we&apos;ll see what we can do.</li>
          <li>You can delete your account at any time under <Link href="/profile">Profile</Link>.</li>
        </ul>
      </section>

      <section>
        <h2>What you post</h2>
        <p>
          Your ratings, comments, notes and the festivals you add stay yours. You let Goodraves store them and show them
          to the people the <Link href="/privacy">privacy policy</Link> describes, for as long as your account exists.
        </p>
        <p>
          Don&apos;t post anything illegal, hateful, harassing or that infringes someone else&apos;s rights. We may remove
          content or suspend accounts that break these terms.
        </p>
      </section>

      <section>
        <h2>Fair use</h2>
        <p>
          Don&apos;t try to break or overload the site, get into other people&apos;s accounts, create accounts
          automatically or scrape the site. Normal personal use is what it&apos;s built for.
        </p>
      </section>

      <section>
        <h2>Event and artist information</h2>
        <p>
          Line-ups, timetables, dates, images and artist details come from public sources, including Resident Advisor,
          Partyflock, FestivalFans, Spotify, Last.fm and Wikipedia. They can be incomplete, out of date or wrong. Always
          check with the organiser before you buy tickets or travel.
        </p>
        <p>
          Goodraves isn&apos;t affiliated with, endorsed by or sponsored by these sources or by any festival, organiser or
          artist. Names, logos and images belong to their owners. If you own something shown here and want it changed or
          taken down, email {mail}.
        </p>
      </section>

      <section>
        <h2>No guarantees</h2>
        <p>
          Goodraves is provided as it is, for free. It may have bugs, be unavailable, or change or stop at any time. As far
          as the law allows, we aren&apos;t liable for losses from using it or relying on its information. Nothing here
          limits rights you have under consumer law that can&apos;t be limited.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If these terms change, the date at the top changes too. If you keep using Goodraves after that, you accept the
          new terms. Questions go to {mail}.
        </p>
      </section>
    </LegalPage>
  )
}
