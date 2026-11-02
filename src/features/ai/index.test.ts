import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
vi.stubEnv("AI_PROVIDER", "fake");
vi.stubEnv("GEMINI_API_KEY", "");
vi.stubEnv("AI_DAILY_QUOTA_PER_TRIP", "30");

import type { AdminClient } from "@/lib/supabase/admin";
import { FakeGenerator } from "./fake";
import { checkQuota, getGenerator } from "./index";

describe("features/ai index", () => {
  it("getGenerator memilih provider dari env", () => {
    expect(getGenerator(() => {})).toBeInstanceOf(FakeGenerator);
  });

  it("checkQuota menghitung kind ≠ import dalam 24 jam untuk trip", async () => {
    const filters: unknown[][] = [];
    const q = {
      select: (...a: unknown[]) => (filters.push(["select", ...a]), q),
      eq: (...a: unknown[]) => (filters.push(["eq", ...a]), q),
      neq: (...a: unknown[]) => (filters.push(["neq", ...a]), q),
      gte: (...a: unknown[]) => (filters.push(["gte", ...a]), Promise.resolve({ count: 28, error: null })),
    };
    const admin = { from: (t: string) => (filters.push(["from", t]), q) } as unknown as AdminClient;
    const now = new Date("2026-11-02T12:00:00Z");
    await expect(checkQuota(admin, "t1", now)).resolves.toEqual({ used: 28, limit: 30, remaining: 2 });
    expect(filters).toEqual([
      ["from", "ai_generations"],
      ["select", "id", { count: "exact", head: true }],
      ["eq", "trip_id", "t1"],
      ["neq", "kind", "import"],
      ["gte", "created_at", "2026-11-01T12:00:00.000Z"],
    ]);
  });
});
