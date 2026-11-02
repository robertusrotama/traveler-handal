import type { LatLng, PlaceMatch } from "./types";
import type { PlaceVerifier } from "./verifier";

/** Query berisi penanda ini → tidak ditemukan (simulasi `unverified`). */
export const FAKE_NOT_FOUND_MARKER = "tidak-ada";

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s.toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
}

/** Pusat kota deterministik (bukan koordinat nyata). */
export function fakeCityCenter(city: string): LatLng {
  const h = hash(city);
  return { lat: (h % 1200) / 20 - 30, lng: ((h >>> 11) % 3400) / 10 - 170 };
}

function fakeMatch(query: string, base: LatLng): PlaceMatch {
  const h = hash(query);
  // offset ≤ ~0,03° (≈ 3 km) agar selalu lolos filter 50 km
  const lat = base.lat + ((h % 600) - 300) / 10_000;
  const lng = base.lng + (((h >>> 10) % 600) - 300) / 10_000;
  const name = query.split(",")[0].trim();
  return {
    provider: "osm",
    providerPlaceId: `node${h}`,
    name,
    lat,
    lng,
    address: query,
    category: null,
    openingHours: null,
    raw: { fake: true, query },
  };
}

/** Verifier deterministik tanpa jaringan (`PLACES_PROVIDER=fake`). */
export class FakeVerifier implements PlaceVerifier {
  async verify(q: Parameters<PlaceVerifier["verify"]>[0]): Promise<PlaceMatch | null> {
    if (q.query.toLowerCase().includes(FAKE_NOT_FOUND_MARKER)) return null;
    return fakeMatch(q.query, q.near ?? fakeCityCenter(q.city));
  }

  async search(q: Parameters<PlaceVerifier["search"]>[0]): Promise<PlaceMatch[]> {
    if (q.text.toLowerCase().includes(FAKE_NOT_FOUND_MARKER)) return [];
    const base = fakeCityCenter(q.text);
    return [1, 2, 3].map((i) => fakeMatch(`${q.text} ${i}`, base));
  }
}
