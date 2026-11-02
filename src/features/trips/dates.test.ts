import { describe, expect, it } from "vitest";
import { formatTripDates, removedDays, startShiftDays } from "./dates";

const old = { start: "2026-12-01", end: "2026-12-07" }; // 7 hari

describe("removedDays", () => {
  it("null bila diperpanjang atau sama panjang", () => {
    expect(removedDays(old, { start: "2026-12-01", end: "2026-12-10" })).toBeNull();
    expect(removedDays(old, { start: "2026-12-05", end: "2026-12-11" })).toBeNull();
  });

  it("menghitung hari terakhir yang terhapus", () => {
    expect(removedDays(old, { start: "2026-12-01", end: "2026-12-05" })).toEqual({ from: 6, to: 7, count: 2 });
    expect(removedDays(old, { start: "2026-12-03", end: "2026-12-03" })).toEqual({ from: 2, to: 7, count: 6 });
  });

  it("null untuk rentang baru tidak valid / belum lengkap", () => {
    expect(removedDays(old, { start: "2026-12-05", end: "2026-12-01" })).toBeNull();
    expect(removedDays(old, { start: "", end: "2026-12-01" })).toBeNull();
  });
});

describe("startShiftDays", () => {
  it("selisih hari, termasuk lintas bulan & mundur", () => {
    expect(startShiftDays("2026-12-01", "2026-12-01")).toBe(0);
    expect(startShiftDays("2026-11-30", "2026-12-02")).toBe(2);
    expect(startShiftDays("2026-12-02", "2026-11-30")).toBe(-2);
  });
});

describe("formatTripDates", () => {
  it("format Indonesia tanpa geser zona waktu", () => {
    expect(formatTripDates("2026-12-01", "2026-12-01")).toBe("1 Des 2026");
    expect(formatTripDates("2026-12-01", "2026-12-07")).toMatch(/^1\s?–\s?7 Des 2026$/);
    expect(formatTripDates("2026-12-28", "2027-01-03")).toMatch(/28 Des 2026\s?–\s?3 Jan 2027/);
  });
});
