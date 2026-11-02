import type { AdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { normalizeQuery, withCity } from "./normalize";
import type { LatLng } from "./types";
import { getVerifier, type PlaceVerifier } from "./verifier";

export const NOT_FOUND_TTL_MS = 30 * 86_400_000;

type Resolved = { id: string } & LatLng;
export type VerifyOutcome = { id: string; status: "verified" | "unverified" };

/**
 * Pipeline F4 per aktivitas: cache → (rate limit) verifier → upsert places + cache → update aktivitas.
 * Kegagalan verifier/DB pada satu aktivitas hanya menandainya `unverified`; aktivitas tidak pernah dibuang.
 * Aktivitas `manual`/`none` dilewati (pilihan manusia tidak ditimpa).
 */
export async function verifyActivities(
  admin: AdminClient,
  tripId: string,
  activityIds: string[],
  deps: { verifier?: PlaceVerifier; now?: () => Date } = {},
): Promise<VerifyOutcome[]> {
  if (activityIds.length === 0) return [];
  const now = deps.now ?? (() => new Date());
  const verifier = deps.verifier ?? getVerifier(admin);

  const { data: trip, error: tripErr } = await admin
    .from("trips")
    .select("country_code, cities")
    .eq("id", tripId)
    .single();
  if (tripErr || !trip) throw tripErr ?? new Error("trip tidak ditemukan");

  const [{ data: acts, error: actErr }, { data: days, error: dayErr }] = await Promise.all([
    admin
      .from("activities")
      .select("id, title, search_query, day_id, verification_status")
      .eq("trip_id", tripId)
      .in("id", activityIds)
      .in("verification_status", ["unverified", "verified"]),
    admin.from("days").select("id, city").eq("trip_id", tripId),
  ]);
  if (actErr) throw actErr;
  if (dayErr) throw dayErr;

  const cc = trip.country_code;
  const dayCity = new Map((days ?? []).map((d) => [d.id, d.city ?? trip.cities[0] ?? null]));
  const centers = new Map<string, Promise<Resolved | null>>();

  async function resolve(query: string, city: string, near: LatLng | null): Promise<Resolved | null> {
    const full = withCity(query, city);
    const key = normalizeQuery(full);
    if (!key) return null;

    const { data: cached, error } = await admin
      .from("geocode_cache")
      .select("place_id, fetched_at")
      .eq("query_normalized", key)
      .eq("country_code", cc)
      .maybeSingle();
    if (error) throw error;
    if (cached?.place_id) {
      const { data: place } = await admin.from("places").select("id, lat, lng").eq("id", cached.place_id).maybeSingle();
      if (place) return place;
    } else if (cached && now().getTime() - Date.parse(cached.fetched_at) < NOT_FOUND_TTL_MS) {
      return null; // not_found yang belum kedaluwarsa
    }

    const match = await verifier.verify({ query: full, city, countryCode: cc, near: near ?? undefined });
    const fetched_at = now().toISOString();
    let place: Resolved | null = null;
    if (match) {
      const { data, error: upErr } = await admin
        .from("places")
        .upsert(
          {
            provider: match.provider,
            provider_place_id: match.providerPlaceId,
            name: match.name,
            lat: match.lat,
            lng: match.lng,
            address: match.address,
            category: match.category,
            opening_hours: match.openingHours,
            raw: match.raw as Json,
            fetched_at,
          },
          { onConflict: "provider,provider_place_id" },
        )
        .select("id, lat, lng")
        .single();
      if (upErr) throw upErr;
      place = data;
    }
    const { error: cacheErr } = await admin
      .from("geocode_cache")
      .upsert(
        { query_normalized: key, country_code: cc, place_id: place?.id ?? null, fetched_at },
        { onConflict: "query_normalized,country_code" },
      );
    if (cacheErr) throw cacheErr;
    return place;
  }

  function cityCenter(city: string): Promise<Resolved | null> {
    if (!centers.has(city)) centers.set(city, resolve(city, city, null).catch(() => null));
    return centers.get(city)!;
  }

  const outcomes: VerifyOutcome[] = [];
  // Berurutan: rate limiter global ≤ 1 req/dtk, paralel tidak mempercepat.
  for (const a of acts ?? []) {
    let placeId: string | null;
    try {
      // Pool ide (day_id null) tidak terikat kota → tanpa filter jarak, query apa adanya.
      const city = a.day_id ? (dayCity.get(a.day_id) ?? null) : null;
      const center = city ? await cityCenter(city) : null;
      placeId = (await resolve(a.search_query || a.title, city ?? "", center))?.id ?? null;
    } catch {
      // Nominatim/DB gagal: yang sudah verified dibiarkan; lainnya unverified (bisa diverifikasi ulang).
      if (a.verification_status === "verified") {
        outcomes.push({ id: a.id, status: "verified" });
        continue;
      }
      placeId = null;
    }
    const status = placeId ? "verified" : "unverified";
    await admin
      .from("activities")
      .update({ place_id: placeId, verification_status: status })
      .eq("id", a.id)
      .eq("trip_id", tripId)
      .in("verification_status", ["unverified", "verified"]);
    outcomes.push({ id: a.id, status });
  }
  return outcomes;
}
