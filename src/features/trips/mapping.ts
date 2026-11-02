import type { TripFormValues } from "@/lib/schemas/trip";
import type { Database, Tables, TablesUpdate } from "@/types/database";

type CreateTripArgs = Database["public"]["Functions"]["create_trip"]["Args"];

export function toCreateTripArgs(v: TripFormValues): CreateTripArgs {
  return {
    // Judul kosong → RPC membuat default "Trip ke {kota}" (dipotong 100 karakter).
    p_title: v.title ?? "",
    p_country_code: v.country_code,
    p_cities: v.cities,
    p_start_date: v.start_date,
    p_end_date: v.end_date,
    p_travelers_count: v.travelers_count,
    p_interests: v.interests,
    p_interests_note: v.interests_note || undefined,
    p_pace: v.pace,
    p_budget_level: v.budget_level,
  };
}

type EditableTrip = Pick<
  Tables<"trips">,
  "title" | "country_code" | "cities" | "travelers_count" | "interests" | "interests_note" | "pace" | "budget_level"
>;

/** Hanya kolom yang berubah (column-level grant: payload berisi kolom tak di-grant ditolak). Tanggal → RPC terpisah. */
export function toTripUpdate(current: EditableTrip, v: TripFormValues): TablesUpdate<"trips"> {
  const next: EditableTrip = {
    title: (v.title || `Trip ke ${v.cities[0]}`).slice(0, 100),
    country_code: v.country_code,
    cities: v.cities,
    travelers_count: v.travelers_count,
    interests: v.interests,
    interests_note: v.interests_note || null,
    pace: v.pace,
    budget_level: v.budget_level,
  };
  return Object.fromEntries(
    (Object.keys(next) as (keyof EditableTrip)[])
      .filter((k) => JSON.stringify(next[k]) !== JSON.stringify(current[k]))
      .map((k) => [k, next[k]]),
  );
}

/** Pesan RPC untuk UI: `hint` = teks Indonesia dari fungsi SQL. */
export function rpcErrorMessage(error: { hint?: string | null; message?: string } | null): string {
  return error?.hint || "Terjadi kesalahan. Coba lagi sebentar lagi.";
}
