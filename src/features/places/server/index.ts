import "server-only";
import { normalizeQuery, verifyActivities, type PlaceMatch, type PlaceVerifier, type VerifyOutcome } from "@/features/places";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/** Bentuk tempat yang dikirim ke client (PlaceSearch, alternatif). */
export type PlaceSummary = { id: string; name: string; lat: number; lng: number; address: string | null };

export async function upsertPlace(admin: AdminClient, m: PlaceMatch): Promise<PlaceSummary> {
  const { data, error } = await admin
    .from("places")
    .upsert(
      {
        provider: m.provider,
        provider_place_id: m.providerPlaceId,
        name: m.name,
        lat: m.lat,
        lng: m.lng,
        address: m.address,
        category: m.category,
        opening_hours: m.openingHours,
        raw: m.raw as Json,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_place_id" },
    )
    .select("id, name, lat, lng, address")
    .single();
  if (error) throw error;
  return data;
}

/** Pusat kota dari geocode_cache (diisi pipeline verifikasi); tanpa request baru ke provider. */
async function cachedCenter(admin: AdminClient, city: string, countryCode: string) {
  const { data } = await admin
    .from("geocode_cache")
    .select("place_id")
    .eq("query_normalized", normalizeQuery(city))
    .eq("country_code", countryCode)
    .maybeSingle();
  if (!data?.place_id) return undefined;
  const { data: p } = await admin.from("places").select("lat, lng").eq("id", data.place_id).maybeSingle();
  return p ?? undefined;
}

/**
 * Verifikasi kandidat yang BELUM menjadi aktivitas (alternatif F6a): verifier → upsert places.
 * shortcut: tanpa geocode_cache per kandidat (hanya 3 query sekali pakai); pakai pipeline bila volumenya naik.
 */
export async function verifyCandidates(
  admin: AdminClient,
  verifier: PlaceVerifier,
  q: { countryCode: string; city: string | null; queries: string[] },
): Promise<(PlaceSummary | null)[]> {
  const city = q.city ?? "";
  const near = city ? await cachedCenter(admin, city, q.countryCode) : undefined;
  const out: (PlaceSummary | null)[] = [];
  // Berurutan: rate limiter global ≤ 1 req/dtk.
  for (const query of q.queries) {
    const match = await verifier.verify({ query, city, countryCode: q.countryCode, near }).catch(() => null);
    out.push(match ? await upsertPlace(admin, match) : null);
  }
  return out;
}

/**
 * `verifyActivities` per potongan kecil sampai `budgetMs` habis, agar request tidak melewati `maxDuration`.
 * Sisa id dikembalikan di `pending` → client memanggil `POST /api/places/verify`.
 */
export async function verifyWithBudget(
  admin: AdminClient,
  tripId: string,
  ids: string[],
  budgetMs: number,
  chunk = 5,
): Promise<{ outcomes: VerifyOutcome[]; pending: string[] }> {
  const deadline = Date.now() + budgetMs;
  const outcomes: VerifyOutcome[] = [];
  let i = 0;
  while (i < ids.length && Date.now() < deadline) {
    try {
      outcomes.push(...(await verifyActivities(admin, tripId, ids.slice(i, i + chunk))));
    } catch (e) {
      // Aktivitas sudah tersimpan `unverified`; sisanya bisa diverifikasi ulang.
      console.error("[places] verifikasi gagal:", (e as Error)?.message);
      break;
    }
    i += chunk;
  }
  return { outcomes, pending: ids.slice(i) };
}
