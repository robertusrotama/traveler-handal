import { describe, expect, it } from "vitest";
import { tripGradient } from "./trip-color";

describe("tripGradient", () => {
  it("deterministik dan bervariasi antar id", () => {
    const a = "3f1c2b9e-0000-4000-8000-000000000001";
    expect(tripGradient(a)).toBe(tripGradient(a));
    const ids = Array.from({ length: 50 }, (_, i) => `trip-${i}`);
    expect(new Set(ids.map(tripGradient)).size).toBeGreaterThan(4);
  });
});
