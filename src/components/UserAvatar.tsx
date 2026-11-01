import Image from 'next/image'

interface UserAvatarProps {
  name: string
  avatarUrl?: string | null
  /** Styles of the box (its size, border and colours); the photo fills it. */
  className?: string
  /** The box's width in px, so the browser asks for a photo that size. */
  size: number
}

/**
 * A person's profile photo, or their initial when they have none. The photo is a tiny file
 * already shrunk when it was uploaded and cached by Cloudflare, so it is shown as it is
 * (`unoptimized`) rather than going through Vercel's image optimiser, which has a monthly quota.
 */
export default function UserAvatar({ name, avatarUrl, className, size }: UserAvatarProps) {
  return (
    <span className={className} aria-hidden="true">
      {avatarUrl ? (
        <Image className="avatar-photo" src={avatarUrl} alt="" width={size} height={size} unoptimized />
      ) : (
        name[0]?.toUpperCase() || 'U'
      )}
    </span>
  )
}
