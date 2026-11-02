import { describe, expect, it } from "vitest";
import { defaultTripTitle, tripDurationDays, tripFormSchema, type TripFormInput } from "./trip";

const base: TripFormInput = {
  country_code: "jp",
  cities: [" Tokyo ", "Kyoto"],
  start_date: "2026-12-01",
  end_date: "2026-12-07",
  travelers_count: 2,
  interests: ["kuliner", "alam"],
  interests_note: "suka ramen",
  pace: "sedang",
  budget_level: "hemat",
};

const errorsFor = (input: unknown) => {
  const r = tripFormSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("tripFormSchema", () => {
  it("menerima input valid dan menormalkan", () => {
    const v = tripFormSchema.parse(base);
    expect(v.country_code).toBe("JP");
    expect(v.cities).toEqual(["Tokyo", "Kyoto"]);
  });

  it("durasi 1 hari (start = end) dan 21 hari valid", () => {
    expect(errorsFor({ ...base, end_date: "2026-12-01" })).toEqual([]);
    expect(errorsFor({ ...base, end_date: "2026-12-21" })).toEqual([]);
  });

  it("menolak end < start dan durasi > 21 hari", () => {
    expect(errorsFor({ ...base, end_date: "2026-11-30" })).toEqual([
      "end_date: Tanggal selesai tidak boleh sebelum tanggal mulai",
    ]);
    expect(errorsFor({ ...base, end_date: "2026-12-22" })).toEqual(["end_date: Durasi trip maksimal 21 hari"]);
  });

  it("menolak kota kosong / tanpa kota / >10 kota", () => {
    expect(errorsFor({ ...base, cities: [] })).toEqual(["cities: Minimal 1 kota"]);
    expect(errorsFor({ ...base, cities: ["  "] })).toEqual(["cities.0: Nama kota tidak boleh kosong"]);
    expect(errorsFor({ ...base, cities: Array.from({ length: 11 }, (_, i) => `K${i}`) })).toEqual([
      "cities: Maksimal 10 kota",
    ]);
  });

  it("menolak negara, jumlah orang, minat, catatan, tanggal tidak valid", () => {
    expect(errorsFor({ ...base, country_code: "JPN" })[0]).toMatch(/^country_code: /);
    expect(errorsFor({ ...base, travelers_count: 0 })).toEqual(["travelers_count: Minimal 1 orang"]);
    expect(errorsFor({ ...base, travelers_count: 51 })).toEqual(["travelers_count: Maksimal 50 orang"]);
    expect(errorsFor({ ...base, travelers_count: 1.5 })).toHaveLength(1);
    expect(errorsFor({ ...base, interests: ["golf"] })).toEqual(["interests.0: Minat tidak dikenal"]);
    expect(errorsFor({ ...base, interests_note: "x".repeat(301) })).toEqual([
      "interests_note: Catatan minat maksimal 300 karakter",
    ]);
    expect(errorsFor({ ...base, start_date: "2026-13-01" })[0]).toMatch(/^start_date: Tanggal mulai/);
    expect(errorsFor({ ...base, pace: "kilat" })).toEqual(["pace: Pilih tempo perjalanan"]);
  });

  it("minat boleh kosong", () => {
    expect(errorsFor({ ...base, interests: [] })).toEqual([]);
  });
});

describe("helpers", () => {
  it("defaultTripTitle", () => {
    expect(defaultTripTitle({ title: "  ", cities: ["Tokyo"] })).toBe("Trip ke Tokyo");
    expect(defaultTripTitle({ title: undefined, cities: ["Bali"] })).toBe("Trip ke Bali");
    expect(defaultTripTitle({ title: "Liburan", cities: ["Bali"] })).toBe("Liburan");
  });
  it("tripDurationDays inklusif, lintas bulan/kabisat", () => {
    expect(tripDurationDays("2028-02-28", "2028-03-01")).toBe(3);
    expect(tripDurationDays("2026-12-01", "2026-12-01")).toBe(1);
  });
});
