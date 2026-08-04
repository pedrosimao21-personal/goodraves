'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { B2bSetData } from '@/context/user-data-state'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480

interface B2bMembersModalProps {
  b2bSet: B2bSetData
  spotifyData: Record<string, any>
  onClose: () => void
}

export default function B2bMembersModal({ b2bSet, spotifyData, onClose }: B2bMembersModalProps) {
  const router = useRouter()

  const goToArtist = (artistId: string, artistName: string) => {
    onClose()
    router.push(`/artist/${artistId}/${encodeURIComponent(artistName)}`)
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: MODAL_Z_INDEX,
        background: 'var(--overlay-scrim)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0)',
      }}
    >
      <div
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          width: '100%', maxWidth: MODAL_MAX_WIDTH,
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
            B2B Set
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {b2bSet.members.map((member) => {
            const image = spotifyData[member.artistName]?.image ?? null
            return (
              <button
                key={member.artistId}
                onClick={() => goToArtist(member.artistId, member.artistName)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  borderRadius: 10,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.95rem',
                  fontFamily: 'var(--font-sans)',
                  width: '100%',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                {image ? (
                  <Image
                    src={image}
                    alt={member.artistName}
                    width={44}
                    height={44}
                    quality={85}
                    sizes="44px"
                    style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem',
                    }}
                  >
                    🎤
                  </div>
                )}
                <span style={{ fontWeight: 600 }}>{member.artistName}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
