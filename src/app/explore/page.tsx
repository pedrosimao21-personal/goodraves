import { redirect } from 'next/navigation'

/**
 * /explore redirects to the default genre so that the dynamic route
 * always has a genre segment to work with.
 */
export default function ExplorePage() {
  redirect('/explore/techno')
}
