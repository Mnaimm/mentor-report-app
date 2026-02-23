/** @type {import('next').NextConfig} */

// Content Security Policy (CSP)
const csp = [
  "default-src 'self'",
  // Next/React dev needs the 'unsafe-*' in many setups; keep minimal
  // LogRocket CDN scripts - comprehensive coverage
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.logrocket.io https://cdn.lr-in.com https://cdn.lr-intake.com https://cdn.lr-ingest.com https://*.logrocket.io https://*.lr-in.com",
  "style-src 'self' 'unsafe-inline'",
  // Allow Auth.js provider logos + LogRocket assets
  "img-src 'self' data: blob: https://authjs.dev https://*.logrocket.io https://*.lr-in.com",
  "font-src 'self' data:",
  // Allow OAuth/API calls during auth + your existing Apps Script usage + LogRocket (comprehensive)
  "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://*.googleapis.com https://accounts.google.com https://www.googleapis.com https://*.logrocket.io https://*.lr-in.com https://*.lr-intake.com https://*.lr-ingest.com https://*.logrocket.com https://r.lr-in.com https://r.lr-intake.com ws://localhost:* wss://localhost:*",
  // Allow Google OAuth pages + Google Docs/Drive preview in frames
  "frame-src 'self' https://accounts.google.com https://docs.google.com https://drive.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  // Allow form posts to your prod domain and Google OAuth
  "form-action 'self' https://mentor-report-app.vercel.app https://accounts.google.com",
  // LogRocket workers
  "worker-src 'self' blob:",
  // Media sources for LogRocket
  "media-src 'self' blob: data:"
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // (optional but good hygiene)
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

          // Your existing CORS headers (keep if you need them)
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
        ]
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/laporan-sesi',
        destination: '/laporan-bangkit',
        permanent: false, // 307 temporary redirect
      },
      {
        source: '/laporan-maju',
        destination: '/laporan-maju-um',
        permanent: false, // 307 temporary redirect
      },
    ];
  }
};

module.exports = nextConfig;
