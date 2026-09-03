/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript / CommonJS sources that Next must compile itself.
  transpilePackages: ['@tamam/shared-types', '@tamam/validation', '@tamam/ui-tokens'],
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  webpack(config) {
    // The workspace packages are symlinked; make sure a single React copy is resolved.
    config.resolve.symlinks = true;
    return config;
  },
};

export default nextConfig;
