import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.scdn.co' },           // Spotify CDN
      { protocol: 'https', hostname: 'i.scdn.co' },           // Spotify images
      { protocol: 'https', hostname: 's1.ticketm.net' },      // Ticketmaster
      { protocol: 'https', hostname: 'images.universe.com' }, // Universe
      { protocol: 'https', hostname: '*.ra.co' },             // Resident Advisor
      { protocol: 'https', hostname: 'ra.co' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' }, // Last.fm images
      { protocol: 'https', hostname: 'assets.awakenings.com' }, // Awakenings
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
              "img-src 'self' data: blob: https://*.scdn.co https://i.scdn.co https://s1.ticketm.net https://images.universe.com https://*.ra.co https://ra.co https://upload.wikimedia.org https://i.imgur.com https://assets.awakenings.com https://*.tile.openstreetmap.org https://lastfm.freetls.fastly.net https://*.basemaps.cartocdn.com",
              "connect-src 'self' https://app.ticketmaster.com https://api.spotify.com https://accounts.spotify.com https://ws.audioscrobbler.com https://edmtrain.com https://en.wikipedia.org",
              "frame-src 'none'",
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
