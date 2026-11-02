import { describe, expect, it } from "vitest";
import { POSITION_STEP, needsRebalance, positionBetween, rebalance } from "./ordering";

describe("positionBetween", () => {
  it("semantik dasar", () => {
    expect(positionBetween()).toBe(POSITION_STEP);
    expect(positionBetween(2048)).toBe(3072);
    expect(positionBetween(undefined, 1024)).toBe(0);
    expect(positionBetween(undefined, -5)).toBe(-1029);
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it("selalu di antara tetangga, sampai butuh rebalance", () => {
    let a = 1024;
    const b = 2048;
    let n = 0;
    while (!needsRebalance(a, b)) {
      const p = positionBetween(a, b);
      expect(p).toBeGreaterThan(a);
      expect(p).toBeLessThan(b);
      a = p;
      n++;
    }
    expect(n).toBeGreaterThan(20);
  });
});

describe("needsRebalance / rebalance", () => {
  it("ambang 1e-6", () => {
    expect(needsRebalance(1, 1 + 1e-7)).toBe(true);
    expect(needsRebalance(1, 1 + 1e-5)).toBe(false);
  });

  it("urut ulang berdasarkan posisi dengan jarak STEP", () => {
    expect(
      rebalance([
        { id: "c", position: 3 },
        { id: "a", position: 1 },
        { id: "b", position: 1.0000001 },
      ]),
    ).toEqual([
      { id: "a", position: 1024 },
      { id: "b", position: 2048 },
      { id: "c", position: 3072 },
    ]);
    expect(rebalance([])).toEqual([]);
  });
});
