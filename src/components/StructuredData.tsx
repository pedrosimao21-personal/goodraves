import { SITE_URL } from '@/lib/site'

const SITE_NAME = 'Goodraves'
const LOGO_URL = `${SITE_URL}/icon-512.png`

const STRUCTURED_DATA = [
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  { '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: LOGO_URL },
]

/**
 * schema.org markup that tells Google the site's name and logo. `<` is escaped
 * so the JSON can never close its own script tag.
 */
export default function StructuredData() {
  const json = JSON.stringify(STRUCTURED_DATA).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
