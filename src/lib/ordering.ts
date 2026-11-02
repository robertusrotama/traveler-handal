// Fractional ordering (lihat Data-Model "Ordering"). Posisi = double precision.
export const POSITION_STEP = 1024;

/**
 * Posisi baru di antara `before` dan `after` (keduanya opsional):
 * kosong → STEP; di akhir → before + STEP; di awal → after − STEP; di tengah → rata-rata.
 */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return POSITION_STEP;
  if (after === undefined) return before! + POSITION_STEP;
  if (before === undefined) return after - POSITION_STEP;
  return (before + after) / 2;
}

/** True bila dua posisi bertetangga terlalu rapat → rebalance seluruh hari/pool. */
export function needsRebalance(a: number, b: number): boolean {
  return Math.abs(b - a) < 1e-6;
}

/** Urut ulang dengan jarak STEP, mempertahankan urutan posisi saat ini. */
export function rebalance<T extends { id: string; position: number }>(items: T[]): { id: string; position: number }[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((it, i) => ({ id: it.id, position: (i + 1) * POSITION_STEP }));
}
