import type { Tables } from "@/types/database";

export type Trip = Tables<"trips">;
export type Day = Tables<"days">;
export type Activity = Tables<"activities">;
export type Member = Pick<
  Tables<"trip_members">,
  "id" | "trip_id" | "user_id" | "display_name" | "role" | "can_use_ai" | "revoked_at" | "joined_at"
>;
export type PlaceLite = Pick<Tables<"places">, "id" | "name" | "lat" | "lng" | "address" | "opening_hours">;

/** Semua data halaman trip; disimpan apa adanya di cache TanStack Query dan snapshot offline. */
export type TripData = {
  trip: Trip;
  days: Day[];
  /** Tidak berurutan; urutkan lewat `activitiesIn`. `day_id` null = pool ide. */
  activities: Activity[];
  places: Record<string, PlaceLite>;
  members: Member[];
  me: Member;
};

/** Aktivitas satu hari (atau pool bila `dayId` null), urut `position` lalu `id` (sama dengan `rebalance_positions`). */
export function activitiesIn(activities: Activity[], dayId: string | null): Activity[] {
  return activities
    .filter((a) => a.day_id === dayId)
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
