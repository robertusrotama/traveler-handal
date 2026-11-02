import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Origin pihak ketiga dibaca saat build (NEXT_PUBLIC_* sudah tersedia).
function origin(url: string | undefined, fallback = ""): string {
  try {
    return url ? new URL(url).origin : fallback;
  } catch {
    return fallback;
  }
}
const supabase = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseWs = supabase.replace(/^http/, "ws"); // https→wss, http→ws (lokal)
const mapTiles = origin(process.env.NEXT_PUBLIC_MAP_STYLE_URL, "https://tiles.openfreemap.org");
const turnstile = "https://challenges.cloudflare.com";

// CSP tanpa nonce (Next 16 guide "Without Nonces"): 'unsafe-inline' untuk script/style karena
// Next menyisipkan script inline & nonce mewajibkan render dinamis + proxy (milik WP lain).
// Risiko XSS ditekan oleh React escaping + larangan dangerouslySetInnerHTML (Security.md).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${turnstile}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.googleusercontent.com ${mapTiles}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs} ${mapTiles}`,
  `frame-src ${turnstile}`,
  "worker-src 'self' blob:", // sw.js + worker MapLibre
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .join("; ")
  .replace(/ {2,}/g, " ");

const nextConfig: NextConfig = {
  // Cache Components sengaja dimatikan: hampir semua halaman dinamis per-user (cookies Supabase).
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
        ],
      },
      {
        // SW harus selalu segar agar versi baru langsung terpasang.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
