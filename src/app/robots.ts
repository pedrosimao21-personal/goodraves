import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/** Public pages are crawlable; personal and admin routes are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/dashboard', '/friends', '/following', '/profile'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
