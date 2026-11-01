'use client'

import { useState, type FormEvent } from 'react'
import { signOut } from 'next-auth/react'
import Sheet, { SheetActions } from '@/components/Sheet'
import { changePassword, deleteAccount } from '@/db/actions/account'
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/constants'
import { CONTACT_EMAIL } from '@/lib/site'
import { Field } from './ProfileFields'
import styles from './Profile.module.css'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/** Collapsed to a button until opened, so the profile doesn't show two empty password inputs. */
export function PasswordField() {
  const [isOpen, setIsOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  function close() {
    setIsOpen(false)
    setCurrent('')
    setNext('')
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      await changePassword(current, next)
      close()
      setIsDone(true)
    } catch (err) {
      setError(errorMessage(err, 'Could not change your password. Try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Field title="Password" hint="Forgot it? Confirm an email address above and you can reset it from the login page.">
      {!isOpen ? (
        <div>
          <button type="button" className="btn" onClick={() => { setIsOpen(true); setIsDone(false) }}>Change password</button>
          {isDone && <p className={`form-hint ${styles.accountNote}`} role="status">Password changed.</p>}
        </div>
      ) : (
        <form className="form-stack" onSubmit={handleSubmit}>
          <div>
            <label className="form-label" htmlFor="profile-current-password">Current password</label>
            <input id="profile-current-password" className="form-input" type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <label className="form-label" htmlFor="profile-new-password">New password</label>
            <input id="profile-new-password" className="form-input" type="password" value={next} onChange={e => setNext(e.target.value)} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} required autoComplete="new-password" />
            <p className={`form-hint ${styles.accountNote}`}>At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className={styles.inline}>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save password'}</button>
            <button type="button" className="btn" onClick={close}>Cancel</button>
          </div>
        </form>
      )}
    </Field>
  )
}

/** Confirm step for erasing the account: asks for the password again, then signs out. */
function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsBusy(true)
    setError(null)
    try {
      await deleteAccount(password)
      await signOut({ callbackUrl: '/' })
    } catch (err) {
      setError(errorMessage(err, 'Could not delete your account. Try again.'))
      setIsBusy(false)
    }
  }

  return (
    <Sheet title="Delete account?" eyebrow="Account" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className={styles.deleteText}>
          This permanently deletes your account, festivals, ratings, notes, comments, follows and friends. You can&apos;t undo this.
        </p>
        <label className="form-label" htmlFor="delete-account-password">Your password</label>
        <input id="delete-account-password" className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <p className={`form-error ${styles.accountNote}`} role="alert">{error}</p>}
        <SheetActions>
          <button type="button" className="btn" onClick={onClose}>Keep my account</button>
          <button type="submit" className="btn btn-danger" disabled={isBusy || !password}>
            {isBusy ? 'Deleting…' : 'Delete account'}
          </button>
        </SheetActions>
      </form>
    </Sheet>
  )
}

export function AccountField() {
  const [isDeleting, setIsDeleting] = useState(false)
  return (
    <Field title="Account" hint={`Want a copy of your data? Email ${CONTACT_EMAIL}.`}>
      <div className={styles.inline}>
        <button type="button" className="btn" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
        <button type="button" className="btn btn-danger" onClick={() => setIsDeleting(true)}>Delete account</button>
      </div>
      {isDeleting && <DeleteAccountSheet onClose={() => setIsDeleting(false)} />}
    </Field>
  )
}
