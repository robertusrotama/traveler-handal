import { pickCandidate } from "./geo";
import type { PlaceMatch } from "./types";
import { withCity } from "./normalize";
import type { PlaceVerifier } from "./verifier";

type NominatimResult = {
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  category?: string;
  type?: string;
  extratags?: Record<string, string> | null;
};

export type NominatimOptions = {
  userAgent: string;
  email?: string;
  /** Wajib ditunggu sebelum SETIAP request keluar (rate limiter global). */
  acquireSlot: () => Promise<void>;
  fetch?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

export function toPlaceMatch(r: NominatimResult): PlaceMatch {
  return {
    provider: "osm",
    providerPlaceId: `${r.osm_type}${r.osm_id}`,
    name: r.name || r.display_name?.split(",")[0]?.trim() || "",
    lat: Number(r.lat),
    lng: Number(r.lon),
    address: r.display_name ?? null,
    category: r.category && r.type ? `${r.category}:${r.type}` : null,
    openingHours: r.extratags?.opening_hours ?? null,
    raw: r as unknown as Record<string, unknown>,
  };
}

/** OSM Nominatim publik: ≤ 1 req/dtk global, User-Agent + email kontak, tanpa autocomplete. */
export class NominatimVerifier implements PlaceVerifier {
  constructor(private readonly opts: NominatimOptions) {}

  private async request(params: Record<string, string>): Promise<PlaceMatch[]> {
    const url = new URL("/search", this.opts.baseUrl ?? "https://nominatim.openstreetmap.org");
    const all: Record<string, string> = { format: "jsonv2", addressdetails: "1", extratags: "1", ...params };
    if (this.opts.email) all.email = this.opts.email;
    for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);

    await this.opts.acquireSlot();
    const res = await (this.opts.fetch ?? fetch)(url, {
      headers: { "User-Agent": this.opts.userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const body = (await res.json()) as NominatimResult[];
    return body.map(toPlaceMatch).filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  async verify(q: Parameters<PlaceVerifier["verify"]>[0]): Promise<PlaceMatch | null> {
    const results = await this.request({
      q: withCity(q.query, q.city),
      countrycodes: q.countryCode.toLowerCase(),
      limit: "3",
    });
    return pickCandidate(results, q.near);
  }

  async search(q: Parameters<PlaceVerifier["search"]>[0]): Promise<PlaceMatch[]> {
    const params: Record<string, string> = { q: q.text.trim(), limit: "5" };
    if (q.countryCode) params.countrycodes = q.countryCode.toLowerCase();
    return this.request(params);
  }
}
