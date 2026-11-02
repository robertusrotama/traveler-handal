import { tripDurationDays } from "@/lib/schemas/trip";

// Tanggal trip = tanggal kalender (YYYY-MM-DD) → format di UTC agar tidak bergeser zona waktu.
const dayFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Contoh: "1–7 Des 2026", "28 Des 2026 – 3 Jan 2027". */
export function formatTripDates(start: string, end: string): string {
  return start === end ? dayFmt.format(utc(start)) : dayFmt.formatRange(utc(start), utc(end));
}

/**
 * Hari yang terhapus bila rentang baru lebih pendek (nomor hari 1-based, inklusif).
 * `update_trip_dates` menghapus hari dengan day_index ≥ jumlah hari baru dan memindah aktivitasnya ke pool.
 */
export function removedDays(
  old: { start: string; end: string },
  next: { start: string; end: string },
): { from: number; to: number; count: number } | null {
  const oldCount = tripDurationDays(old.start, old.end);
  const newCount = tripDurationDays(next.start, next.end);
  if (!(newCount >= 1) || newCount >= oldCount) return null;
  return { from: newCount + 1, to: oldCount, count: oldCount - newCount };
}

/** Selisih hari tanggal mulai (positif = mundur ke belakang). */
export function startShiftDays(oldStart: string, newStart: string): number {
  return tripDurationDays(oldStart, newStart) - 1;
}
