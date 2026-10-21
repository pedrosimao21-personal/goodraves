'use client'

import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import { SearchIcon } from '@/components/icons'
import { detectUrlSource } from './search-url-import'
import styles from './Discover.module.css'

interface SearchFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  isLoading: boolean
}

/** Discover headline and search bar. Board: Discover / DiscoverMobile. */
export default function SearchForm({ value, onChange, onSubmit, isLoading }: SearchFormProps) {
  const loadingLabel = detectUrlSource(value) ? 'Importing…' : 'Searching…'

  return (
    <section className={styles.hero}>
      <p className={`mono ${styles.eyebrow}`}>Discover · festivals, raves and club nights</p>
      <h1 className={`display ${styles.headline}`}>Find the next one.</h1>
      <form role="search" className={styles.form} onSubmit={onSubmit} id="festival-search-form">
        <div className={styles.field}>
          <SearchIcon size={22} className={styles.fieldIcon} />
          <label htmlFor="festival-search-input" className="sr-only">Search festivals, DJs, venues or cities</label>
          <input
            id="festival-search-input"
            className={styles.input}
            type="text"
            placeholder="Festival, DJ, venue or city"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          id="search-submit-btn"
          type="submit"
          className={`btn btn-primary ${styles.submit}`}
          disabled={isLoading}
          onPointerDown={keepKeyboardOpenOnTap}
          aria-label={isLoading ? loadingLabel : 'Search'}
        >
          <SearchIcon size={20} className={styles.submitIcon} />
          <span className={styles.submitLabel}>{isLoading ? loadingLabel : 'Search'}</span>
        </button>
      </form>
      <p className={styles.hint}>Or paste a Resident Advisor, FestivalFans or Partyflock link to import the event.</p>
    </section>
  )
}
