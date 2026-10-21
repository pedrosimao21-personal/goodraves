'use client'

import { useState, type ReactNode } from 'react'
import { signOut } from 'next-auth/react'
import { useTheme } from '@/context/ThemeContext'
import { THEME_PREFERENCES, type ThemePreference } from '@/lib/theme-constants'
import { MAX_CITY_LENGTH, MAX_GENRES_LENGTH } from '@/lib/constants'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import { CloseIcon, PlusIcon } from '@/components/icons'
import { parseGenres } from './use-profile'
import styles from './Profile.module.css'

const THEME_LABELS: Record<ThemePreference, string> = { dark: 'Dark', light: 'Light', system: 'System' }
const SAVE_FAILED = 'Could not save. Try again.'

/** One settings row: title and hint on the left, the control on the right. Board: Profile. */
function Field({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <div>
        <h2 className={styles.fieldTitle}>{title}</h2>
        {hint && <p className={styles.fieldHint}>{hint}</p>}
      </div>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  )
}

/** Re-mount it with a new key when the saved value changes, so the input starts from it. */
export function CityField({ value, onSave }: { value: string; onSave: (city: string) => Promise<void> }) {
  const [input, setInput] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(input.trim())
    } catch {
      setError(SAVE_FAILED)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Field title="Home city" hint="Drives “Near you”, trending festivals and distances.">
      <div className={styles.inline}>
        <label htmlFor="profile-city" className="sr-only">Home city</label>
        <input
          id="profile-city"
          className="form-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save() }}
          placeholder="e.g. Amsterdam"
          maxLength={MAX_CITY_LENGTH}
        />
        <button type="button" className="btn" onClick={save} onPointerDown={keepKeyboardOpenOnTap} disabled={isSaving || input.trim() === value}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </Field>
  )
}

/** Genres as removable chips; adding or removing one saves the list straight away. */
export function GenresField({ value, onSave }: { value: string; onSave: (genres: string) => Promise<void> }) {
  const genres = parseGenres(value)
  const [draft, setDraft] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (next: string[]) => {
    const joined = next.join(', ')
    if (joined.length > MAX_GENRES_LENGTH) {
      setError('That is too many genres.')
      return
    }
    setError(null)
    try {
      await onSave(joined)
      setDraft('')
      setIsAdding(false)
    } catch {
      setError(SAVE_FAILED)
    }
  }

  const add = () => {
    const genre = draft.trim()
    if (!genre || genres.some(g => g.toLowerCase() === genre.toLowerCase())) return
    save([...genres, genre])
  }

  return (
    <Field title="Favourite genres" hint="Used for “Tailored for you”.">
      <div className={styles.chips}>
        {genres.map(genre => (
          <span key={genre} className={`chip ${styles.genreChip}`}>
            {genre}
            <button type="button" className={styles.chipRemove} onClick={() => save(genres.filter(g => g !== genre))} aria-label={`Remove ${genre}`}>
              <CloseIcon size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {isAdding ? (
          <span className={styles.inline}>
            <label htmlFor="profile-genre" className="sr-only">New genre</label>
            <input
              id="profile-genre"
              className={`form-input ${styles.genreInput}`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setIsAdding(false) }}
              placeholder="e.g. Techno"
              autoFocus
            />
            <button type="button" className="btn btn-sm" onClick={add} onPointerDown={keepKeyboardOpenOnTap}>Add</button>
          </span>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => setIsAdding(true)}>
            <PlusIcon size={13} strokeWidth={2} />Add genre
          </button>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
    </Field>
  )
}

export function ThemeField() {
  const { preference, setPreference } = useTheme()
  return (
    <Field title="Theme" hint="System follows your device.">
      <div className={styles.seg} role="group" aria-label="Theme">
        {THEME_PREFERENCES.map(option => (
          <button
            key={option}
            type="button"
            className={preference === option ? styles.segOn : undefined}
            aria-pressed={preference === option}
            onClick={() => setPreference(option)}
          >
            {THEME_LABELS[option]}
          </button>
        ))}
      </div>
    </Field>
  )
}

export function PrivacyField() {
  return (
    <Field title="What friends see">
      <p className={styles.privacy}><span className="mono">Shared</span>Festivals, set ratings, comments for friends, follows</p>
      <p className={styles.privacy}><span className="mono">Private</span>Personal notes</p>
    </Field>
  )
}

export function AccountField() {
  return (
    <Field title="Account">
      <div>
        <button type="button" className="btn" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
      </div>
    </Field>
  )
}
