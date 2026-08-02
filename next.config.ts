import type { NextConfig } from 'next';

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? '';

/** Заголовки безопасности задаются здесь, а не в <meta>: статику GH Pages это не умела. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://" + SUPABASE_HOST,
      "font-src 'self'",
      "connect-src 'self' https://" + SUPABASE_HOST + ' wss://' + SUPABASE_HOST,
      "media-src 'self' blob: https://" + SUPABASE_HOST,
      "form-action 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { optimizePackageImports: ['framer-motion'] },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
