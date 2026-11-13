import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * `script-src` needs `'unsafe-inline'`: the App Router streams its own inline
 * bootstrap scripts and Next 16 gives no nonce here without threading one
 * through middleware. It still blocks every third-party script origin, which is
 * the injection path that matters. `style-src` needs `'unsafe-inline'` for
 * Radix and Leaflet, who set element styles directly.
 *
 * Only applied in production builds. The dev server compiles with eval and
 * talks over a websocket, and a CSP that blocks those would break `next dev`
 * without protecting anything a developer cares about.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Ignored by browsers on a plain-HTTP origin, so it is safe in dev and takes
  // effect as soon as the site is behind HTTPS in production.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Do not advertise the framework. Saves nothing against a determined
  // attacker, but removes a free hint for scanning bots.
  poweredByHeader: false,
  reactStrictMode: true,
  // No remotePatterns: every image on this site is now served from /images or
  // from uploads, both local. The two hostnames that used to be allow-listed
  // (images.unsplash.com and commondatastorage.googleapis.com) were the stock
  // photos and Google's demo videos that have since been replaced, and leaving
  // them here would keep the door open for a stock URL to be pasted back in.
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        // Security headers for every route
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Customer receipts (/r/<token>) — personal data on a public URL.
        //
        // This entry comes SECOND on purpose. Next applies every matching rule
        // and a later value for the same header key wins, so listing it after the
        // catch-all is what makes `no-referrer` override the site-wide
        // `strict-origin-when-cross-origin`. Do not reorder these two.
        //
        // noindex via header rather than only via the page's metadata, because
        // the header also covers the Server Action endpoint and any future file
        // added under /r/. robots.txt deliberately does NOT list /r/ — a
        // Disallow line would advertise the path and, paradoxically, be ignored
        // by the crawlers that matter here.
        source: "/r/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, private" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
