import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*.trycloudflare.com"],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "commondatastorage.googleapis.com",
      },
    ],
  },
  async headers() {
    return [
      {
        // Security headers for every route
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
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
