import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Container dev: @playwright/test 1.64 tetapi browser terpasang 1.63 → pakai binary langsung.
// CI mengosongkan PW_CHROMIUM_PATH agar memakai browser hasil `playwright install`.
const localChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PW_CHROMIUM_PATH ?? (existsSync(localChromium) ? localChromium : undefined);

const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // satu stack Supabase lokal bersama
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: executablePath || undefined } },
    },
  ],
  webServer: {
    // Env dari .env.local (Supabase lokal, AI_PROVIDER=fake, PLACES_PROVIDER=fake).
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
