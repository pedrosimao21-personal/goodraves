import type { ComponentType } from 'react'
import { CompassIcon, TicketIcon, HeartIcon, StatsIcon, FriendsIcon, type IconProps } from '@/components/icons'

export interface NavItem {
  href: string
  /** Label in the desktop top bar. */
  label: string
  /** Shorter label under the icon in the mobile tab bar. */
  shortLabel: string
  icon: ComponentType<IconProps>
  /** Path prefixes that mark this item active. '/' only matches exactly. */
  matches: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Discover', shortLabel: 'Discover', icon: CompassIcon, matches: ['/'] },
  { href: '/dashboard', label: 'My festivals', shortLabel: 'Festivals', icon: TicketIcon, matches: ['/dashboard', '/timeline'] },
  { href: '/following', label: 'Following', shortLabel: 'Following', icon: HeartIcon, matches: ['/following'] },
  { href: '/top-djs', label: 'Stats', shortLabel: 'Stats', icon: StatsIcon, matches: ['/top-djs', '/insights'] },
  { href: '/friends', label: 'Friends', shortLabel: 'Friends', icon: FriendsIcon, matches: ['/friends'] },
]

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.matches.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
