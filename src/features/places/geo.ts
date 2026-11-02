import type { LatLng } from "./types";

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Kandidat teratas yang berjarak ≤ maxKm dari pusat; tanpa pusat → kandidat teratas. */
export function pickCandidate<T extends LatLng>(candidates: T[], center?: LatLng | null, maxKm = 50): T | null {
  if (!center) return candidates[0] ?? null;
  return candidates.find((c) => haversineKm(c, center) <= maxKm) ?? null;
}
