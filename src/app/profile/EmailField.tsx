'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { getAccountEmail, resendVerificationEmail, setAccountEmail, type AccountEmail } from '@/db/actions/account-email'
import { MAX_EMAIL_LENGTH } from '@/lib/constants'
import { Field } from './ProfileFields'
import styles from './Profile.module.css'

const NO_EMAIL: AccountEmail = { email: null, isVerified: false }

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/** The account's email: status line, plus a form (asking for the password again) to set, change or remove it. */
export function EmailField() {
  const [account, setAccount] = useState<AccountEmail>(NO_EMAIL)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    getAccountEmail().then(setAccount).catch(() => setError('Could not load your email.')).finally(() => setIsLoaded(true))
  }, [])

  function close() {
    setIsOpen(false)
    setInput('')
    setPassword('')
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      const result = await setAccountEmail(input, password)
      setAccount({ email: result.email, isVerified: result.isVerified })
      setNotice(
        !result.email ? 'Email removed.'
          : result.isEmailSent ? `We sent a confirmation link to ${result.email}.`
          : 'Saved, but the confirmation email could not be sent. Use "Resend link".'
      )
      close()
    } catch (err) {
      setError(errorMessage(err, 'Could not save your email. Try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResend() {
    setError(null)
    try {
      setNotice((await resendVerificationEmail()) ? 'Confirmation link sent.' : 'The email could not be sent. Try again later.')
    } catch (err) {
      setError(errorMessage(err, 'Could not send the link. Try again.'))
    }
  }

  const hint = 'Log in with it, reset a forgotten password, and get the notifications you choose.'

  return (
    <Field title="Email" hint={hint}>
      {isLoaded && !isOpen && (
        <div>
          <p className={styles.accountNote}>
            {account.email ?? 'No email yet.'}
            {account.email && <span className={`mono ${styles.muted}`}> · {account.isVerified ? 'Confirmed' : 'Not confirmed yet'}</span>}
          </p>
          <div className={styles.inline}>
            <button type="button" className="btn" onClick={() => { setIsOpen(true); setNotice(null); setInput(account.email ?? '') }}>
              {account.email ? 'Change email' : 'Add email'}
            </button>
            {account.email && !account.isVerified && <button type="button" className="btn" onClick={handleResend}>Resend link</button>}
          </div>
          {notice && <p className={`form-hint ${styles.accountNote}`} role="status">{notice}</p>}
          {error && <p className={`form-error ${styles.accountNote}`} role="alert">{error}</p>}
        </div>
      )}
      {isOpen && (
        <form className="form-stack" onSubmit={handleSubmit}>
          <div>
            <label className="form-label" htmlFor="profile-email">Email address</label>
            <input id="profile-email" className="form-input" type="email" value={input} onChange={e => setInput(e.target.value)} maxLength={MAX_EMAIL_LENGTH} autoComplete="email" />
            <p className={`form-hint ${styles.accountNote}`}>Leave it empty to remove your email.</p>
          </div>
          <div>
            <label className="form-label" htmlFor="profile-email-password">Current password</label>
            <input id="profile-email-password" className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className={styles.inline}>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save email'}</button>
            <button type="button" className="btn" onClick={close}>Cancel</button>
          </div>
        </form>
      )}
    </Field>
  )
}
