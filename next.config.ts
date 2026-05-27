import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Cache transformed images for 31 days — reduces repeated transformations for
    // stable CDN sources (Spotify, Last.fm, RA, etc.) that rarely change.
    minimumCacheTTL: 2678400,
    // Limit formats to WebP only; AVIF would double transformation count per image.
    formats: ['image/webp'],
    // Custom sizes tailored to actual usage in the app, reducing the number of
    // possible transformation variants from the large Next.js defaults.
    imageSizes: [20, 44, 48, 56, 80, 120, 200],
    deviceSizes: [400, 640, 828, 1200],
    remotePatterns: [
      { protocol: 'https', hostname: '*.scdn.co' },           // Spotify CDN
      { protocol: 'https', hostname: 'i.scdn.co' },           // Spotify images
      { protocol: 'https', hostname: 'images.universe.com' }, // Universe
      { protocol: 'https', hostname: '*.ra.co' },             // Resident Advisor
      { protocol: 'https', hostname: 'ra.co' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' }, // Last.fm images
      { protocol: 'https', hostname: 'assets.awakenings.com' }, // Awakenings
      { protocol: 'https', hostname: 'festivalfans.nl' },       // FestivalFans
      { protocol: 'https', hostname: 'partyflock.nl' },          // Partyflock
      { protocol: 'https', hostname: 'photo.partyflock.nl' },    // Partyflock photos
      { protocol: 'https', hostname: 'static.partyflock.nl' },   // Partyflock static
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.scdn.co https://i.scdn.co https://images.universe.com https://*.ra.co https://ra.co https://upload.wikimedia.org https://i.imgur.com https://assets.awakenings.com https://*.tile.openstreetmap.org https://lastfm.freetls.fastly.net https://*.basemaps.cartocdn.com https://festivalfans.nl https://partyflock.nl https://photo.partyflock.nl https://static.partyflock.nl",
              "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://ws.audioscrobbler.com https://en.wikipedia.org",
              "frame-src 'self' https://open.spotify.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
