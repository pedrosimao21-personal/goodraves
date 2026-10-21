'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchIcon } from '@/components/icons'
import PopularFestivalList from './PopularFestivalList'
import styles from './DashboardEmpty.module.css'

const STEPS = [
  { title: 'Add festivals you went to', body: 'Past ones become your history. Upcoming ones become your schedule.' },
  { title: 'Rate the sets you saw', body: 'Your ratings build your Top DJs and the yearly passport.' },
  { title: 'Follow artists', body: 'Their next gigs show up in Following, with clashes flagged.' },
]
const STEP_DIGITS = 2

type Props = {
  isUpcoming: boolean
  /** Nothing on either list yet: show the mixed popular list and how it works. */
  isFirstRun: boolean
  userCity: string | null
}

/** An empty list: a search, popular festivals to add, and on first run how it works. Board: MyFestivalsEmpty. */
export default function DashboardEmpty({ isUpcoming, isFirstRun, userCity }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/?${new URLSearchParams({ q }).toString()}` : '/')
  }

  return (
    <div className={styles.empty}>
      <h2 className={`display ${styles.emptyTitle}`}>
        {isUpcoming ? 'Nothing planned yet.' : 'Your history starts with one festival.'}
      </h2>
      <form role="search" className={styles.emptyForm} onSubmit={handleSubmit}>
        <div className={styles.emptyField}>
          <SearchIcon size={20} className={styles.emptyIcon} />
          <label htmlFor="dashboard-empty-search" className="sr-only">Search for a festival</label>
          <input
            id="dashboard-empty-search"
            className={styles.emptyInput}
            placeholder={isUpcoming ? 'Which festival are you going to?' : 'Which festival did you go to last?'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" id="go-discover-btn">Search</button>
      </form>
      <PopularFestivalList isUpcoming={isUpcoming} isFirstRun={isFirstRun} userCity={userCity} />
      {isFirstRun && (
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={`display ${styles.stepNumber}`}>{String(index + 1).padStart(STEP_DIGITS, '0')}</span>
              <span>
                <span className={styles.stepTitle}>{step.title}</span>
                <span className={styles.stepBody}>{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
