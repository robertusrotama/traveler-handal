import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AdminClient } from "@/lib/supabase/admin";
import { FakeVerifier } from "./fake";
import { normalizeQuery } from "./normalize";
import { verifyActivities } from "./pipeline";
import type { PlaceVerifier } from "./verifier";

type Row = Record<string, unknown>;

/** Fake minimal query builder supabase-js (select/eq/in/single/maybeSingle/upsert/update). */
function fakeAdmin(tables: Record<string, Row[]>) {
  let seq = 0;
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "update" | "upsert" = "select";
    let payload: Row = {};
    let conflict: string[] = [];
    const exec = async (): Promise<{ data: Row[] | null; error: null }> => {
      if (op === "upsert") {
        let row = rows.find((r) => conflict.every((k) => r[k] === payload[k]));
        if (row) Object.assign(row, payload);
        else rows.push((row = { id: `${table}-${++seq}`, ...payload }));
        return { data: [row], error: null };
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        hit.forEach((r) => Object.assign(r, payload));
        return { data: null, error: null };
      }
      return { data: hit, error: null };
    };
    const b = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), b),
      update: (p: Row) => ((op = "update"), (payload = p), b),
      upsert: (p: Row, o: { onConflict: string }) => ((op = "upsert"), (payload = p), (conflict = o.onConflict.split(",")), b),
      single: () => exec().then(({ data }) => ({ data: data?.[0] ?? null, error: data?.[0] ? null : { message: "no rows" } })),
      maybeSingle: () => exec().then(({ data }) => ({ data: data?.[0] ?? null, error: null })),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => exec().then(res, rej),
    };
    return b;
  };
  return { from } as unknown as AdminClient;
}

const NOW = new Date("2026-11-02T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function world(activities: Row[], extra: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    trips: [{ id: "t1", country_code: "JP", cities: ["Kyoto"] }],
    days: [{ id: "d1", trip_id: "t1", city: "Kyoto" }],
    activities: activities.map((a) => ({ trip_id: "t1", day_id: "d1", verification_status: "unverified", place_id: null, ...a })),
    places: [],
    geocode_cache: [],
    ...extra,
  };
  const fake = new FakeVerifier();
  const verify = vi.fn((q: Parameters<PlaceVerifier["verify"]>[0]) => fake.verify(q));
  const verifier: PlaceVerifier = { verify, search: (q) => fake.search(q) };
  return { tables, verify, run: (ids: string[], v = verifier) => verifyActivities(fakeAdmin(tables), "t1", ids, { verifier: v, now: () => NOW }) };
}

describe("verifyActivities", () => {
  it("cache miss: geocode pusat kota + aktivitas, upsert places & cache, set verified", async () => {
    const w = world([{ id: "a1", title: "Kinkaku-ji", search_query: "Kinkaku-ji, Kyoto" }]);
    expect(await w.run(["a1"])).toEqual([{ id: "a1", status: "verified" }]);
    expect(w.verify).toHaveBeenCalledTimes(2);
    expect(w.verify.mock.calls[0][0]).toMatchObject({ query: "Kyoto", near: undefined });
    expect(w.verify.mock.calls[1][0]).toMatchObject({ query: "Kinkaku-ji, Kyoto", countryCode: "JP", near: expect.any(Object) });
    expect(w.tables.places).toHaveLength(2);
    expect(w.tables.geocode_cache.map((c) => c.query_normalized).sort()).toEqual(["kinkaku-ji, kyoto", "kyoto"]);
    const a = w.tables.activities[0];
    expect(a.verification_status).toBe("verified");
    expect(w.tables.places.some((p) => p.id === a.place_id)).toBe(true);
  });

  it("cache hit: tanpa memanggil verifier", async () => {
    const places = [
      { id: "p-city", lat: 35, lng: 135.7 },
      { id: "p-act", lat: 35.03, lng: 135.72 },
    ];
    const cache = [
      { query_normalized: "kyoto", country_code: "JP", place_id: "p-city", fetched_at: daysAgo(100) },
      { query_normalized: normalizeQuery("Kinkaku-ji, Kyoto"), country_code: "JP", place_id: "p-act", fetched_at: daysAgo(100) },
    ];
    const w = world([{ id: "a1", title: "Kinkaku-ji", search_query: "Kinkaku-ji" }], { places, geocode_cache: cache });
    expect(await w.run(["a1"])).toEqual([{ id: "a1", status: "verified" }]);
    expect(w.verify).not.toHaveBeenCalled();
    expect(w.tables.activities[0].place_id).toBe("p-act");
  });

  it("not_found < 30 hari → unverified tanpa request; ≥ 30 hari → dicoba ulang", async () => {
    const cache = (age: number) => [
      { query_normalized: "kyoto", country_code: "JP", place_id: "p-city", fetched_at: daysAgo(1) },
      { query_normalized: "toko lama, kyoto", country_code: "JP", place_id: null, fetched_at: daysAgo(age) },
    ];
    const places = [{ id: "p-city", lat: 35, lng: 135.7 }];
    const act = [{ id: "a1", title: "Toko Lama", search_query: "Toko Lama, Kyoto" }];

    const fresh = world(act, { places: [...places], geocode_cache: cache(10) });
    expect(await fresh.run(["a1"])).toEqual([{ id: "a1", status: "unverified" }]);
    expect(fresh.verify).not.toHaveBeenCalled();

    const expired = world(act, { places: [...places], geocode_cache: cache(31) });
    expect(await expired.run(["a1"])).toEqual([{ id: "a1", status: "verified" }]);
    expect(expired.verify).toHaveBeenCalledTimes(1);
  });

  it("tidak ditemukan → cache not_found + unverified", async () => {
    const w = world([{ id: "a1", title: "X", search_query: "tempat tidak-ada" }]);
    expect(await w.run(["a1"])).toEqual([{ id: "a1", status: "unverified" }]);
    expect(w.tables.geocode_cache.find((c) => c.query_normalized === "tempat tidak-ada, kyoto")).toMatchObject({ place_id: null });
  });

  it("verifier gagal → unverified, aktivitas tetap ada; yang sudah verified tidak diturunkan; tidak di-cache", async () => {
    const w = world([
      { id: "a1", title: "A", search_query: "A, Kyoto" },
      { id: "a2", title: "B", search_query: "B, Kyoto", verification_status: "verified", place_id: "p-old" },
    ]);
    const broken: PlaceVerifier = { verify: async () => Promise.reject(new Error("Nominatim HTTP 503")), search: async () => [] };
    expect(await w.run(["a1", "a2"], broken)).toEqual([
      { id: "a1", status: "unverified" },
      { id: "a2", status: "verified" },
    ]);
    expect(w.tables.activities).toHaveLength(2);
    expect(w.tables.activities[1]).toMatchObject({ verification_status: "verified", place_id: "p-old" });
    expect(w.tables.geocode_cache).toHaveLength(0);
  });

  it("melewati aktivitas manual/none; pool tanpa filter jarak & tanpa kota", async () => {
    const w = world([
      { id: "m1", title: "Manual", search_query: null, verification_status: "manual" },
      { id: "p1", title: "Ide", search_query: "Nishiki Market, Kyoto", day_id: null },
    ]);
    expect(await w.run(["m1", "p1"])).toEqual([{ id: "p1", status: "verified" }]);
    expect(w.verify).toHaveBeenCalledTimes(1);
    expect(w.verify.mock.calls[0][0]).toMatchObject({ query: "Nishiki Market, Kyoto", city: "", near: undefined });
    expect(w.tables.activities[0].verification_status).toBe("manual");
  });
});
