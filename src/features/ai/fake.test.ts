import { describe, expect, it } from "vitest";
import { buildTripContext } from "./context";
import { FAKE_FAIL_MARKER, FakeGenerator } from "./fake";
import type { AiCallRecord } from "./generator";

const trip = {
  country_code: "ID",
  cities: ["Yogyakarta", "Bandung"],
  start_date: "2026-12-01",
  end_date: "2026-12-04",
  travelers_count: 2,
  interests: ["kuliner"],
  interests_note: null,
  pace: "padat" as const,
  budget_level: "hemat" as const,
};

describe("FakeGenerator", () => {
  it("deterministik, valid, memakai nama kota, dan melapor onCall", async () => {
    const records: AiCallRecord[] = [];
    const gen = new FakeGenerator((r) => void records.push(r));
    const ctx = buildTripContext(trip);
    const outline = await gen.outline(ctx);
    expect(outline.days.map((d) => d.city)).toEqual(["Yogyakarta", "Yogyakarta", "Bandung", "Bandung"]);
    const d = await gen.day(ctx, { dayIndex: 2, date: "2026-12-03", city: "Bandung", theme: null });
    expect(d.activities).toHaveLength(5);
    expect(d.activities[0].searchQuery).toMatch(/Bandung$/);
    expect(await gen.day(ctx, { dayIndex: 2, date: "2026-12-03", city: "Bandung", theme: null })).toEqual(d);
    expect((await gen.ideas(ctx, [])).ideas.length).toBeGreaterThanOrEqual(8);
    const alt = await gen.alternatives(ctx, { dayIndex: 0, date: "2026-12-01", city: "Yogyakarta", theme: null, current: { title: "X", category: "kuliner", startTime: "13:00", durationMin: 60 } });
    expect(alt.alternatives.map((a) => a.startTime)).toEqual(["13:00", "13:00", "13:00"]);
    expect(records).toHaveLength(5);
  });

  it("penanda gagal → AiError upstream dan record gagal", async () => {
    const records: AiCallRecord[] = [];
    const gen = new FakeGenerator((r) => void records.push(r));
    const ctx = buildTripContext(trip, { instruction: `tolong ${FAKE_FAIL_MARKER}` });
    await expect(gen.outline(ctx)).rejects.toMatchObject({ code: "upstream" });
    expect(records[0].ok).toBe(false);
  });
});
