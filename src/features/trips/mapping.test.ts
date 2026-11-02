import { describe, expect, it } from "vitest";
import { tripFormSchema, type TripFormInput } from "@/lib/schemas/trip";
import { rpcErrorMessage, toCreateTripArgs, toTripUpdate } from "./mapping";

const input: TripFormInput = {
  title: "",
  country_code: "jp",
  cities: [" Tokyo ", "Kyoto"],
  start_date: "2026-12-01",
  end_date: "2026-12-07",
  travelers_count: 2,
  interests: ["kuliner", "alam"],
  interests_note: "",
  pace: "padat",
  budget_level: "hemat",
};
const values = tripFormSchema.parse(input);

describe("toCreateTripArgs", () => {
  it("memetakan form ter-validasi ke argumen create_trip", () => {
    expect(toCreateTripArgs(values)).toEqual({
      p_title: "",
      p_country_code: "JP",
      p_cities: ["Tokyo", "Kyoto"],
      p_start_date: "2026-12-01",
      p_end_date: "2026-12-07",
      p_travelers_count: 2,
      p_interests: ["kuliner", "alam"],
      p_interests_note: undefined,
      p_pace: "padat",
      p_budget_level: "hemat",
    });
  });

  it("meneruskan judul & catatan bila diisi", () => {
    const v = tripFormSchema.parse({ ...input, title: " Liburan ", interests_note: " ramen " });
    expect(toCreateTripArgs(v)).toMatchObject({ p_title: "Liburan", p_interests_note: "ramen" });
  });
});

describe("toTripUpdate", () => {
  const current = {
    title: "Trip ke Tokyo",
    country_code: "JP",
    cities: ["Tokyo", "Kyoto"],
    travelers_count: 2,
    interests: ["kuliner", "alam"],
    interests_note: null,
    pace: "padat" as const,
    budget_level: "hemat" as const,
  };

  it("kosong bila tidak ada yang berubah (judul kosong = default)", () => {
    expect(toTripUpdate(current, values)).toEqual({});
  });

  it("hanya kolom yang berubah, tanpa tanggal", () => {
    const v = tripFormSchema.parse({ ...input, cities: ["Osaka"], pace: "santai", interests_note: "onsen", end_date: "2026-12-03" });
    expect(toTripUpdate(current, v)).toEqual({
      title: "Trip ke Osaka",
      cities: ["Osaka"],
      pace: "santai",
      interests_note: "onsen",
    });
  });

  it("judul default dipotong 100 karakter", () => {
    const v = tripFormSchema.parse({ ...input, cities: ["x".repeat(100)] });
    expect(toTripUpdate(current, v).title).toHaveLength(100);
  });
});

describe("rpcErrorMessage", () => {
  it("memakai hint, fallback bila kosong", () => {
    expect(rpcErrorMessage({ message: "invalid_dates", hint: "Tanggal salah." })).toBe("Tanggal salah.");
    expect(rpcErrorMessage({ message: "boom", hint: "" })).toMatch(/Coba lagi/);
    expect(rpcErrorMessage(null)).toMatch(/Coba lagi/);
  });
});
