import "server-only";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { FakeVerifier } from "./fake";
import { NominatimVerifier } from "./nominatim";
import { createDbRateLimiter } from "./rate-limit";
import type { LatLng, PlaceMatch } from "./types";

/** Antarmuka geocoding (ADR-0005). MVP: NominatimVerifier; test/E2E: FakeVerifier. */
export interface PlaceVerifier {
  /** Cocokkan satu aktivitas; null bila tidak ada kandidat (dalam ≤ 50 km dari `near` bila diberikan). */
  verify(q: { query: string; city: string; countryCode: string; near?: LatLng }): Promise<PlaceMatch | null>;
  /** Pencarian eksplisit (tombol "Cari", bukan as-you-type). */
  search(q: { text: string; countryCode?: string }): Promise<PlaceMatch[]>;
}

/** Verifier sesuai `PLACES_PROVIDER`; Nominatim selalu lewat rate limiter global DB. */
export function getVerifier(admin: AdminClient = createAdminClient()): PlaceVerifier {
  const env = serverEnv();
  if (env.PLACES_PROVIDER === "fake") return new FakeVerifier();
  return new NominatimVerifier({
    userAgent: env.NOMINATIM_USER_AGENT,
    email: env.NOMINATIM_EMAIL,
    acquireSlot: createDbRateLimiter(admin),
  });
}
