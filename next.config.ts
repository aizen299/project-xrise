import type { NextConfig } from 'next';

/**
 * Applied to every response. The app is same-origin (UI and API ship in one
 * Next.js deployment), so there is no Access-Control-Allow-Origin header to
 * emit — cross-origin browser calls are refused by default, which is the
 * locked-down CORS posture the assignment asks for (REQ-035).
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework; it narrows an attacker's search space.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers:
          process.env.NODE_ENV === 'production'
            ? [
                ...securityHeaders,
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
