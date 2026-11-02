import type { MetadataRoute } from "next";

// Ikon dibuat oleh scripts/generate-icons.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Traveler Handal",
    short_name: "Handal",
    description: "Rencanakan perjalanan bersama teman — itinerary bisa dibuka offline.",
    lang: "id",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    theme_color: "#2563eb",
    background_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
