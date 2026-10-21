'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchIcon } from '@/components/icons'
import styles from './DashboardEmpty.module.css'

/** First-run state: no festivals yet, so point at a search. Board: MyFestivalsEmpty. */
export default function DashboardEmpty({ isUpcoming }: { isUpcoming: boolean }) {
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
    </div>
  )
}
