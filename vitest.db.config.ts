import { defineConfig } from "vitest/config";

// Integrasi DB (RLS + RPC) di Postgres lokal. Lihat supabase/tests/helpers.ts.
export default defineConfig({
  test: {
    include: ["supabase/tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["supabase/tests/global-setup.ts"],
    testTimeout: 20_000,
  },
});
