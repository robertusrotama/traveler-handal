import type { Activity, Day, Member, Trip, TripData } from "./types";

export type RealtimeChange = {
  table: "activities" | "days" | "trip_members" | "trips";
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type Result = { data: TripData; refetch: boolean };

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const i = rows.findIndex((r) => r.id === row.id);
  if (i < 0) return [...rows, row];
  const next = rows.slice();
  next[i] = row;
  return next;
}

/**
 * Terapkan event Realtime ke cache. INSERT/UPDATE → patch baris; DELETE (hanya membawa PK, tanpa filter)
 * → buang baris bila milik trip ini lalu minta refetch. `refetch` juga true bila data join (places) kurang.
 */
export function applyRealtimeChange(data: TripData, change: RealtimeChange): Result {
  const unchanged = { data, refetch: false };

  if (change.eventType === "DELETE") {
    const id = change.old.id as string | undefined;
    if (!id) return unchanged;
    switch (change.table) {
      case "activities":
        if (!data.activities.some((a) => a.id === id)) return unchanged;
        return { data: { ...data, activities: data.activities.filter((a) => a.id !== id) }, refetch: true };
      case "days":
        return { data, refetch: data.days.some((d) => d.id === id) };
      case "trip_members":
        return { data, refetch: data.members.some((m) => m.id === id) || data.me.id === id };
      case "trips":
        return { data, refetch: data.trip.id === id };
    }
  }

  const row = change.new;
  switch (change.table) {
    case "activities": {
      const a = row as Activity;
      if (a.trip_id !== data.trip.id) return unchanged;
      const cached = data.activities.find((x) => x.id === a.id);
      // Last-write-wins (ADR-0007): abaikan event yang lebih lama dari yang sudah di cache.
      if (cached && cached.updated_at > a.updated_at) return unchanged;
      return {
        data: { ...data, activities: upsert(data.activities, a) },
        refetch: a.place_id !== null && !data.places[a.place_id],
      };
    }
    case "days": {
      const d = row as Day;
      if (d.trip_id !== data.trip.id) return unchanged;
      const days = upsert(data.days, d).sort((x, y) => x.day_index - y.day_index);
      return { data: { ...data, days }, refetch: false };
    }
    case "trip_members": {
      const m = pickMember(row);
      if (m.trip_id !== data.trip.id) return unchanged;
      const me = m.id === data.me.id ? m : data.me;
      const members = m.revoked_at ? data.members.filter((x) => x.id !== m.id) : upsert(data.members, m);
      return { data: { ...data, members, me }, refetch: false };
    }
    case "trips": {
      const t = row as Trip;
      if (t.id !== data.trip.id) return unchanged;
      // Perubahan tanggal trip ikut menambah/menghapus hari → refetch agar days konsisten.
      const datesChanged = t.start_date !== data.trip.start_date || t.end_date !== data.trip.end_date;
      return { data: { ...data, trip: t }, refetch: datesChanged };
    }
  }
}

function pickMember(row: Record<string, unknown>): Member {
  const { id, trip_id, user_id, display_name, role, can_use_ai, revoked_at, joined_at } = row as Member;
  return { id, trip_id, user_id, display_name, role, can_use_ai, revoked_at, joined_at };
}
