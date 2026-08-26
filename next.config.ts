import type { NextConfig } from 'next';


const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',

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
