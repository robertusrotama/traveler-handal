import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Activity, PlaceLite, TripData } from "./types";

export type TripFetchResult =
  | { status: "ok"; data: TripData }
  | { status: "revoked" }
  | { status: "not_found" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dipakai server (render awal) dan client (refetch). RLS: non-member tidak mendapat apa pun,
 * member yang dicabut hanya melihat baris `trip_members` miliknya.
 */
export async function fetchTripData(
  supabase: SupabaseClient<Database>,
  tripId: string,
  userId: string,
): Promise<TripFetchResult> {
  if (!UUID.test(tripId)) return { status: "not_found" };

  const [members, trip, days, activities] = await Promise.all([
    supabase
      .from("trip_members")
      .select("id, trip_id, user_id, display_name, role, can_use_ai, revoked_at, joined_at")
      .eq("trip_id", tripId)
      .order("joined_at"),
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase.from("days").select("*").eq("trip_id", tripId).order("day_index"),
    supabase
      .from("activities")
      .select("*, place:places(id, name, lat, lng, address, opening_hours)")
      .eq("trip_id", tripId),
  ]);
  const error = members.error ?? trip.error ?? days.error ?? activities.error;
  if (error) throw error;

  const mine = members.data.filter((m) => m.user_id === userId);
  const me = mine.find((m) => !m.revoked_at) ?? mine[0];
  if (!me) return { status: "not_found" };
  if (me.revoked_at) return { status: "revoked" };
  if (!trip.data) return { status: "not_found" };

  const places: Record<string, PlaceLite> = {};
  const rows: Activity[] = activities.data.map(({ place, ...a }) => {
    if (place) places[place.id] = place;
    return a;
  });

  return {
    status: "ok",
    data: {
      trip: trip.data,
      days: days.data,
      activities: rows,
      places,
      members: members.data.filter((m) => !m.revoked_at),
      me,
    },
  };
}
