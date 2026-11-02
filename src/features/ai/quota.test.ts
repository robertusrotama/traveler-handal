import { describe, expect, it } from "vitest";
import { canUseAi, quotaFromCount } from "./quota";

describe("quota", () => {
  it("menghitung sisa, tidak negatif", () => {
    expect(quotaFromCount(0, 30)).toEqual({ used: 0, limit: 30, remaining: 30 });
    expect(quotaFromCount(29, 30).remaining).toBe(1);
    expect(quotaFromCount(35, 30).remaining).toBe(0);
  });
});

describe("canUseAi", () => {
  const m = { role: "member" as const, can_use_ai: false, revoked_at: null };
  it("owner selalu, member bila diizinkan, dicabut/null tidak", () => {
    expect(canUseAi({ ...m, role: "owner" })).toBe(true);
    expect(canUseAi(m)).toBe(false);
    expect(canUseAi({ ...m, can_use_ai: true })).toBe(true);
    expect(canUseAi({ ...m, can_use_ai: true, revoked_at: "2026-11-01T00:00:00Z" })).toBe(false);
    expect(canUseAi(null)).toBe(false);
  });
});
