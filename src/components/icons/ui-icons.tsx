import type { ReactNode, SVGProps } from 'react'

// Line icons for the redesign (docs/redesign/README.md): 24px grid, round
// caps and joins, currentColor. Decorative by default (aria-hidden); pass
// aria-label plus role="img" when an icon carries meaning on its own.

const DEFAULT_ICON_SIZE = 20
const ICON_STROKE_WIDTH = 1.75

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** Solid variant, for the icons that have one (heart, bookmark). */
  filled?: boolean
}

function createIcon(displayName: string, paths: ReactNode, filledPaths?: ReactNode) {
  function Icon({ size = DEFAULT_ICON_SIZE, filled = false, ...props }: IconProps) {
    const isSolid = filled && filledPaths !== undefined
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={isSolid ? 'currentColor' : 'none'}
        stroke={isSolid ? 'none' : 'currentColor'}
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {isSolid ? filledPaths : paths}
      </svg>
    )
  }
  Icon.displayName = displayName
  return Icon
}

const HEART_PATH = <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
const BOOKMARK_PATH = <path d="M6 3h12v18l-6-4-6 4z" />

export const SearchIcon = createIcon('SearchIcon', <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>)
export const CheckIcon = createIcon('CheckIcon', <path d="m5 12 5 5 9-10" />)
export const PlusIcon = createIcon('PlusIcon', <path d="M12 5v14M5 12h14" />)
export const CloseIcon = createIcon('CloseIcon', <path d="M6 6l12 12M18 6 6 18" />)
export const HeartIcon = createIcon('HeartIcon', HEART_PATH, HEART_PATH)
export const BookmarkIcon = createIcon('BookmarkIcon', BOOKMARK_PATH, BOOKMARK_PATH)
export const PinIcon = createIcon('PinIcon', <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>)
export const CalendarIcon = createIcon('CalendarIcon', <><rect x="4" y="5" width="16" height="16" rx="1" /><path d="M4 10h16M9 3v4M15 3v4" /></>)
export const ShareIcon = createIcon('ShareIcon', <path d="M12 3v13M7 8l5-5 5 5M5 14v6h14v-6" />)
export const DownloadIcon = createIcon('DownloadIcon', <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />)
export const WarningIcon = createIcon('WarningIcon', <><path d="M12 3 2 21h20z" /><path d="M12 10v5M12 18v.5" /></>)
export const ArrowLeftIcon = createIcon('ArrowLeftIcon', <path d="M19 12H5M11 6l-6 6 6 6" />)
export const ArrowRightIcon = createIcon('ArrowRightIcon', <path d="M5 12h14M13 6l6 6-6 6" />)
export const ExternalIcon = createIcon('ExternalIcon', <path d="M7 17 17 7M8 7h9v9" />)
export const ChevronDownIcon = createIcon('ChevronDownIcon', <path d="m6 9 6 6 6-6" />)
export const ChevronRightIcon = createIcon('ChevronRightIcon', <path d="M9 6l6 6-6 6" />)
export const FriendsIcon = createIcon('FriendsIcon', <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6" /></>)
export const AddFriendIcon = createIcon('AddFriendIcon', <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></>)
export const TicketIcon = createIcon('TicketIcon', <><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><path d="M15 7v10" strokeDasharray="2 2.5" /></>)
export const CompassIcon = createIcon('CompassIcon', <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>)
export const StatsIcon = createIcon('StatsIcon', <path d="M5 20V11M12 20V4M19 20v-6" />)
export const EditIcon = createIcon('EditIcon', <path d="M4 20h4L19 9l-4-4L4 16z" />)
export const LinkIcon = createIcon('LinkIcon', <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>)
export const RefreshIcon = createIcon('RefreshIcon', <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />)
export const MergeIcon = createIcon('MergeIcon', <path d="M6 4v6a6 6 0 0 0 6 6h6M14 12l4 4-4 4M6 20v-2" />)

/** Three horizontal dots (overflow menu). Drawn filled, so no stroke. */
export function DotsIcon({ size = DEFAULT_ICON_SIZE, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}
