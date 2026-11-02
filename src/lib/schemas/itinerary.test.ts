import { describe, expect, it } from "vitest";
import {
  alternativesResultSchema,
  dayResultSchema,
  formatZodError,
  ideasResultSchema,
  importPayloadSchema,
  jsonSchemaFor,
  outlineResultSchema,
} from "./itinerary";

const act = (over: Record<string, unknown> = {}) => ({
  title: "Fushimi Inari Taisha",
  category: "sejarah_budaya",
  startTime: "08:00",
  durationMin: 120,
  why: "Gerbang torii ikonik.",
  searchQuery: "Fushimi Inari Taisha, Kyoto",
  ...over,
});
const idea = (i: number) => ({ title: `Ide ${i}`, category: "kuliner", why: "", searchQuery: `Ide ${i}, Kyoto` });
const day = (over: Record<string, unknown> = {}) => ({
  dayIndex: 0,
  theme: "Kuil",
  city: "Kyoto",
  activities: [act()],
  ...over,
});

describe("activity / day", () => {
  it("valid", () => {
    expect(dayResultSchema.safeParse(day()).success).toBe(true);
    expect(dayResultSchema.safeParse(day({ activities: [act({ startTime: null })] })).success).toBe(true);
  });

  it("jam: 23:59 valid; 24:00, 9:00, 12:60 invalid", () => {
    expect(dayResultSchema.safeParse(day({ activities: [act({ startTime: "23:59" })] })).success).toBe(true);
    for (const t of ["24:00", "9:00", "12:60", "", "08:00:00"]) {
      expect(dayResultSchema.safeParse(day({ activities: [act({ startTime: t })] })).success).toBe(false);
    }
  });

  it("batas durasi 15..600 dan bilangan bulat", () => {
    const ok = (d: number) => dayResultSchema.safeParse(day({ activities: [act({ durationMin: d })] })).success;
    expect([ok(15), ok(600), ok(14), ok(601), ok(30.5)]).toEqual([true, true, false, false, false]);
  });

  it("aktivitas 1..8", () => {
    expect(dayResultSchema.safeParse(day({ activities: [] })).success).toBe(false);
    expect(dayResultSchema.safeParse(day({ activities: Array(8).fill(act()) })).success).toBe(true);
    expect(dayResultSchema.safeParse(day({ activities: Array(9).fill(act()) })).success).toBe(false);
  });

  it("panjang teks: title ≤120, why ≤200, searchQuery wajib", () => {
    expect(dayResultSchema.safeParse(day({ activities: [act({ title: "x".repeat(121) })] })).success).toBe(false);
    expect(dayResultSchema.safeParse(day({ activities: [act({ title: "  " })] })).success).toBe(false);
    expect(dayResultSchema.safeParse(day({ activities: [act({ why: "x".repeat(201) })] })).success).toBe(false);
    expect(dayResultSchema.safeParse(day({ activities: [act({ searchQuery: "" })] })).success).toBe(false);
  });

  it("kategori tak dikenal → lainnya; huruf besar dinormalkan", () => {
    const r = dayResultSchema.parse(day({ activities: [act({ category: "museum" }), act({ category: " Kuliner " })] }));
    expect(r.activities.map((a) => a.category)).toEqual(["lainnya", "kuliner"]);
  });

  it("menolak input kosong / bukan objek", () => {
    expect(dayResultSchema.safeParse({}).success).toBe(false);
    expect(dayResultSchema.safeParse(null).success).toBe(false);
  });
});

describe("outline / ideas / alternatives", () => {
  it("outline", () => {
    expect(outlineResultSchema.safeParse({ days: [{ dayIndex: 0, theme: "A", city: "Tokyo" }] }).success).toBe(true);
    expect(outlineResultSchema.safeParse({ days: [] }).success).toBe(false);
    expect(outlineResultSchema.safeParse({ days: [{ dayIndex: -1, theme: "A", city: "Tokyo" }] }).success).toBe(false);
  });

  it("ideas 8..15", () => {
    const n = (k: number) => ideasResultSchema.safeParse({ ideas: Array.from({ length: k }, (_, i) => idea(i)) }).success;
    expect([n(7), n(8), n(15), n(16)]).toEqual([false, true, true, false]);
  });

  it("alternatives tepat 3", () => {
    const n = (k: number) => alternativesResultSchema.safeParse({ alternatives: Array(k).fill(act()) }).success;
    expect([n(2), n(3), n(4)]).toEqual([false, true, false]);
  });
});

describe("importPayloadSchema", () => {
  it("valid dengan / tanpa ideas", () => {
    expect(importPayloadSchema.safeParse({ days: [day()] }).success).toBe(true);
    expect(importPayloadSchema.safeParse({ days: [day()], ideas: [idea(1)] }).success).toBe(true);
  });
  it("menolak dayIndex ganda dan days kosong", () => {
    const r = importPayloadSchema.safeParse({ days: [day(), day()] });
    expect(r.success).toBe(false);
    expect(formatZodError(r.error!)).toBe("- days[1].dayIndex: dayIndex 0 muncul dua kali");
    expect(importPayloadSchema.safeParse({ days: [] }).success).toBe(false);
  });
});

describe("formatZodError", () => {
  it("ringkas, berbahasa Indonesia, dengan path", () => {
    const r = dayResultSchema.safeParse(day({ activities: [act({ startTime: "24:00", durationMin: 5 })] }));
    expect(formatZodError(r.error!)).toBe(
      [
        '- activities[0].startTime: Jam mulai harus format "HH:MM" (00:00–23:59) atau null',
        "- activities[0].durationMin: Durasi minimal 15 menit",
      ].join("\n"),
    );
  });
  it("membatasi jumlah baris dan pesan bawaan pakai locale id", () => {
    const r = dayResultSchema.safeParse({ activities: "x" });
    const text = formatZodError(r.error!, 2);
    expect(text.split("\n")).toHaveLength(3);
    expect(text).toMatch(/…dan \d+ kesalahan lain/);
    expect(formatZodError(dayResultSchema.safeParse("x").error!)).toMatch(/^- \(dokumen\): /);
  });
});

describe("jsonSchemaFor", () => {
  it("menghasilkan JSON Schema untuk tiap jenis", () => {
    for (const k of ["outline", "day", "ideas", "alternatives", "import"] as const) {
      const s = jsonSchemaFor(k);
      expect(s.type).toBe("object");
    }
    const day = jsonSchemaFor("day") as { properties: { activities: { items: { properties: Record<string, unknown> } } } };
    expect(day.properties.activities.items.properties.category).toMatchObject({ enum: expect.arrayContaining(["lainnya"]) });
  });
});
