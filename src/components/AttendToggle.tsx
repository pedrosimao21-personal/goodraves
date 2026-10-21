'use client'

import type { MouseEvent } from 'react'
import { CheckIcon, PlusIcon } from '@/components/icons'
import styles from './AttendToggle.module.css'

const ICON_SIZE = { sm: 15, md: 16, lg: 18 } as const

interface AttendToggleProps {
  /** Upcoming festivals toggle "Going"; past ones toggle "Attended". */
  isFuture: boolean
  isActive: boolean
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void
  size?: keyof typeof ICON_SIZE
  id?: string
}

export default function AttendToggle({ isFuture, isActive, onToggle, size = 'md', id }: AttendToggleProps) {
  const label = isFuture ? 'Going' : 'Attended'
  const stateClass = isActive ? (isFuture ? styles.going : styles.attended) : ''
  const sizeClass = size === 'sm' ? styles.small : size === 'lg' ? styles.large : ''
  const Icon = isActive ? CheckIcon : PlusIcon

  return (
    <button
      type="button"
      id={id}
      className={`${styles.toggle} ${sizeClass} ${stateClass}`}
      aria-pressed={isActive}
      onClick={onToggle}
    >
      <Icon size={ICON_SIZE[size]} strokeWidth={2} />
      {label}
    </button>
  )
}
