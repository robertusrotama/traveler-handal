import { INTERESTS, tripDurationDays, type Budget, type Interest, type Pace } from "@/lib/schemas/trip";
import type { TripContext } from "./types";

/** Kolom `trips` yang boleh dipakai. Baris lengkap boleh dioper; field lain diabaikan. */
export type TripContextSource = {
  country_code: string;
  cities: string[];
  start_date: string;
  end_date: string;
  travelers_count: number;
  interests: string[];
  interests_note: string | null;
  pace: Pace;
  budget_level: Budget;
};

export const MAX_INSTRUCTION_CHARS = 500;
const MAX_EXISTING = 100;

/**
 * Whitelist eksplisit: hanya konteks perjalanan yang masuk ke prompt.
 * Jangan pernah spread `trip` — nama, email, catatan member/aktivitas tidak boleh ikut (ADR-0005).
 */
export function buildTripContext(
  trip: TripContextSource,
  extras: { existingPlaces?: string[]; instruction?: string | null } = {},
): TripContext {
  const existing = [...new Set((extras.existingPlaces ?? []).map((t) => t.trim().slice(0, 120)).filter(Boolean))];
  const instruction = extras.instruction?.trim().slice(0, MAX_INSTRUCTION_CHARS) || null;
  return {
    countryCode: trip.country_code,
    cities: trip.cities.map((c) => c.trim()).filter(Boolean),
    startDate: trip.start_date,
    endDate: trip.end_date,
    durationDays: tripDurationDays(trip.start_date, trip.end_date),
    travelersCount: trip.travelers_count,
    interests: trip.interests.filter((i): i is Interest => (INTERESTS as readonly string[]).includes(i)),
    interestsNote: trip.interests_note?.trim().slice(0, 300) || null,
    pace: trip.pace,
    budgetLevel: trip.budget_level,
    existingPlaces: existing.slice(0, MAX_EXISTING),
    instruction,
  };
}
