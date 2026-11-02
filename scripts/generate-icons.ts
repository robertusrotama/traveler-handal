// Membuat ikon PWA (PNG) dari SVG via Chromium Playwright — tanpa dependensi baru.
// Jalankan: node --experimental-strip-types scripts/generate-icons.ts
// Glyph: ikon "plane" lucide (ISC).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const PLANE =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

// glyphScale: porsi kanvas untuk glyph. Maskable butuh glyph di dalam safe zone (lingkaran 80%).
function svg({ rounded, glyphScale }: { rounded: boolean; glyphScale: number }) {
  const g = 100 * glyphScale;
  const off = (100 - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="#2563eb"/>
<svg x="${off}" y="${off}" width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${PLANE}"/></svg>
</svg>`;
}

const out = path.resolve(import.meta.dirname, "../public");
const targets = [
  { file: "icon-192.png", size: 192, rounded: true, glyphScale: 0.6 },
  { file: "icon-512.png", size: 512, rounded: true, glyphScale: 0.6 },
  { file: "icon-maskable-512.png", size: 512, rounded: false, glyphScale: 0.5 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, glyphScale: 0.6 },
];

writeFileSync(path.join(out, "icon.svg"), svg({ rounded: true, glyphScale: 0.6 }));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg(t)}`,
  );
  await page.screenshot({ path: path.join(out, t.file), omitBackground: true });
}
await browser.close();
console.log(`Ikon ditulis ke ${out}`);
