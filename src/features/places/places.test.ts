import { describe, expect, it, vi } from "vitest";
import { FakeVerifier, fakeCityCenter } from "./fake";
import { haversineKm, pickCandidate } from "./geo";
import { NominatimVerifier } from "./nominatim";
import { normalizeQuery, withCity } from "./normalize";
import { checkOpeningHours } from "./opening-hours";
import { createDbRateLimiter } from "./rate-limit";

describe("normalizeQuery / withCity", () => {
  it("lowercase, trim, tanda baca berlebih", () => {
    expect(normalizeQuery("  Fushimi Inari Taisha,  KYOTO!!! ")).toBe("fushimi inari taisha, kyoto");
    expect(normalizeQuery("Kiyomizu-dera (清水寺) ,, Kyoto.")).toBe("kiyomizu-dera 清水寺, kyoto");
    expect(normalizeQuery("Café   de Flore")).toBe("café de flore");
    expect(normalizeQuery("!!!")).toBe("");
  });
  it("withCity hanya menambah kota bila belum ada", () => {
    expect(withCity("Senso-ji", "Tokyo")).toBe("Senso-ji, Tokyo");
    expect(withCity("Senso-ji, tokyo", "Tokyo")).toBe("Senso-ji, tokyo");
    expect(withCity("Senso-ji", "")).toBe("Senso-ji");
  });
});

describe("geo", () => {
  const tokyo = { lat: 35.6812, lng: 139.7671 };
  const kyoto = { lat: 34.9858, lng: 135.7588 };
  it("haversineKm", () => {
    expect(haversineKm(tokyo, tokyo)).toBe(0);
    expect(haversineKm(tokyo, kyoto)).toBeGreaterThan(360);
    expect(haversineKm(tokyo, kyoto)).toBeLessThan(375);
  });
  it("pickCandidate memfilter jarak ≤ 50 km", () => {
    const far = { ...kyoto, id: "far" };
    const near = { lat: 35.7, lng: 139.8, id: "near" };
    expect(pickCandidate([far, near], tokyo)?.id).toBe("near");
    expect(pickCandidate([far], tokyo)).toBeNull();
    expect(pickCandidate([far, near], null)?.id).toBe("far");
    expect(pickCandidate([], tokyo)).toBeNull();
    expect(pickCandidate([far], tokyo, 400)?.id).toBe("far");
  });
});

describe("checkOpeningHours", () => {
  it("format sederhana", () => {
    expect(checkOpeningHours("Mo-Su 09:00-17:00", "10:00")).toBe("open");
    expect(checkOpeningHours("Mo-Su 09:00-17:00", "08:30")).toBe("closed");
    expect(checkOpeningHours("Mo-Su 09:00-17:00", "17:00")).toBe("closed");
    expect(checkOpeningHours("10:00-14:00, 17:00-22:00", "15:00")).toBe("closed");
    expect(checkOpeningHours("10:00-14:00,17:00-22:00", "18:00")).toBe("open");
    expect(checkOpeningHours("18:00-02:00", "01:00")).toBe("open");
    expect(checkOpeningHours("24/7", "03:00")).toBe("open");
  });
  it("hari tertentu butuh tanggal", () => {
    expect(checkOpeningHours("Tu-Su 09:00-17:00", "10:00")).toBe("unknown");
    expect(checkOpeningHours("Tu-Su 09:00-17:00", "10:00", "2026-11-02")).toBe("closed"); // Senin
    expect(checkOpeningHours("Tu-Su 09:00-17:00", "10:00", "2026-11-08")).toBe("open"); // Minggu
    expect(checkOpeningHours("Fr-Mo 09:00-17:00", "10:00", "2026-11-02")).toBe("open"); // wrap
  });
  it("kompleks / kosong → unknown", () => {
    expect(checkOpeningHours("Mo-Fr 09:00-17:00; Sa 10:00-14:00", "10:00")).toBe("unknown");
    expect(checkOpeningHours("sunrise-sunset", "10:00")).toBe("unknown");
    expect(checkOpeningHours(null, "10:00")).toBe("unknown");
    expect(checkOpeningHours("Mo-Su 09:00-17:00", null)).toBe("unknown");
  });
});

describe("createDbRateLimiter", () => {
  it("memanggil RPC lalu tidur sesuai ms yang dikembalikan", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: 750, error: null }).mockResolvedValueOnce({ data: 0, error: null });
    const sleep = vi.fn(async () => {});
    const acquire = createDbRateLimiter({ rpc } as never, "nominatim", 1000, sleep);
    await acquire();
    await acquire();
    expect(rpc).toHaveBeenCalledWith("take_rate_limit_slot", { p_key: "nominatim", p_interval_ms: 1000 });
    expect(sleep.mock.calls).toEqual([[750]]);
  });
  it("error RPC dilempar (tidak boleh request tanpa slot)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("db down") });
    await expect(createDbRateLimiter({ rpc } as never)()).rejects.toThrow("db down");
  });
});

describe("NominatimVerifier", () => {
  const tokyo = { lat: 35.6812, lng: 139.7671 };
  const result = (over: Record<string, unknown>) => ({
    osm_type: "way",
    osm_id: 1,
    lat: "35.7148",
    lon: "139.7967",
    name: "Senso-ji",
    display_name: "Senso-ji, Asakusa, Taito, Tokyo, Japan",
    category: "amenity",
    type: "place_of_worship",
    extratags: { opening_hours: "Mo-Su 06:00-17:00" },
    ...over,
  });

  function setup(body: unknown, status = 200) {
    const order: string[] = [];
    const fetchMock = vi.fn(async () => (order.push("fetch"), new Response(JSON.stringify(body), { status })));
    const v = new NominatimVerifier({
      userAgent: "TravelerHandal/test",
      email: "kontak@example.com",
      acquireSlot: async () => void order.push("slot"),
      fetch: fetchMock as unknown as typeof fetch,
    });
    return { v, fetchMock, order };
  }

  it("parameter request, header, slot sebelum fetch, mapping & filter jarak", async () => {
    const { v, fetchMock, order } = setup([result({ osm_id: 9, lat: "34.98", lon: "135.75" }), result({})]);
    const m = await v.verify({ query: "Senso-ji", city: "Tokyo", countryCode: "JP", near: tokyo });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: "jsonv2",
      addressdetails: "1",
      extratags: "1",
      email: "kontak@example.com",
      q: "Senso-ji, Tokyo",
      countrycodes: "jp",
      limit: "3",
    });
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("TravelerHandal/test");
    expect(order).toEqual(["slot", "fetch"]);
    expect(m).toMatchObject({
      provider: "osm",
      providerPlaceId: "way1",
      name: "Senso-ji",
      lat: 35.7148,
      lng: 139.7967,
      category: "amenity:place_of_worship",
      openingHours: "Mo-Su 06:00-17:00",
    });
  });

  it("semua kandidat > 50 km → null; HTTP error dilempar", async () => {
    expect(await setup([result({ lat: "34.98", lon: "135.75" })]).v.verify({ query: "X", city: "Tokyo", countryCode: "JP", near: tokyo })).toBeNull();
    await expect(setup({}, 503).v.verify({ query: "X", city: "Tokyo", countryCode: "JP" })).rejects.toThrow("503");
  });

  it("search tanpa countrycodes opsional", async () => {
    const { v, fetchMock } = setup([result({})]);
    expect(await v.search({ text: " Senso-ji " })).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(url.searchParams.get("countrycodes")).toBeNull();
    expect(url.searchParams.get("q")).toBe("Senso-ji");
  });
});

describe("FakeVerifier", () => {
  it("deterministik, dekat kota, 'tidak-ada' → null", async () => {
    const v = new FakeVerifier();
    const a = await v.verify({ query: "Museum, Kyoto", city: "Kyoto", countryCode: "JP" });
    expect(a).toEqual(await v.verify({ query: "Museum, Kyoto", city: "Kyoto", countryCode: "JP" }));
    expect(haversineKm(a!, fakeCityCenter("Kyoto"))).toBeLessThan(10);
    expect(await v.verify({ query: "tempat tidak-ada", city: "Kyoto", countryCode: "JP" })).toBeNull();
    expect(await v.search({ text: "Kyoto" })).toHaveLength(3);
  });
});
