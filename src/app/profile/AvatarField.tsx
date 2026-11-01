'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useSession } from 'next-auth/react'
import UserAvatar from '@/components/UserAvatar'
import { removeMyAvatar } from '@/db/actions/avatar'
import { AvatarPhotoError, prepareAvatarPhoto } from '@/lib/avatar-resize'
import { Field } from './ProfileFields'
import styles from './Profile.module.css'

const PREVIEW_SIZE = 64
const UPLOAD_FAILED = 'Could not upload the photo. Try again.'

function messageOf(err: unknown, fallback: string): string {
  return err instanceof AvatarPhotoError ? err.message : fallback
}

async function uploadPhoto(blob: Blob): Promise<void> {
  const res = await fetch('/api/avatar', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob })
  if (res.ok) return
  const data = await res.json().catch(() => ({}))
  throw new AvatarPhotoError(data.error || UPLOAD_FAILED)
}

/** The profile photo: pick one (it is cropped square and shrunk here, in the browser) or remove it. */
export function AvatarField() {
  const { data: session, update } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const avatarUrl = session?.user?.image ?? null
  const name = session?.user?.name ?? ''

  async function run(task: () => Promise<void>, doneNotice: string, fallback: string) {
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      await task()
      await update({}) // any data makes it a POST, which has the server re-read the photo into the session; with none it only re-reads the old one
      setNotice(doneNotice)
    } catch (err) {
      setError(messageOf(err, fallback))
    } finally {
      setIsBusy(false)
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // so choosing the same file again still counts as a change
    if (file) run(async () => uploadPhoto(await prepareAvatarPhoto(file)), 'Photo updated.', UPLOAD_FAILED)
  }

  return (
    <Field title="Photo" hint="Shown to your friends. It is cropped to a square and shrunk on your device before it is uploaded.">
      <div className={styles.inline}>
        <UserAvatar className={`display ${styles.photoPreview}`} name={name} avatarUrl={avatarUrl} size={PREVIEW_SIZE} />
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={handleFile} aria-label="Choose a profile photo" tabIndex={-1} />
        <button type="button" className="btn" disabled={isBusy} onClick={() => inputRef.current?.click()}>
          {isBusy ? 'Working…' : avatarUrl ? 'Change photo' : 'Choose photo'}
        </button>
        {avatarUrl && (
          <button type="button" className="btn" disabled={isBusy} onClick={() => run(removeMyAvatar, 'Photo removed.', 'Could not remove the photo. Try again.')}>
            Remove
          </button>
        )}
      </div>
      {notice && <p className="form-hint" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Field>
  )
}
