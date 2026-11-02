import { needsRebalance, positionBetween } from "@/lib/ordering";

/** Id kontainer drop: hari (`day:<uuid>`) atau pool ide. */
export const POOL = "pool";
export const containerId = (dayId: string | null) => (dayId ? `day:${dayId}` : POOL);
export const dayIdOf = (container: string) => (container === POOL ? null : container.slice(4));

/**
 * Posisi baru untuk disisipkan di `toIndex` pada `target` (urut, TANPA item yang dipindah).
 * `rebalance` = tetangga terlalu rapat → panggil RPC `rebalance_positions` setelah update.
 */
export function planMove(target: { position: number }[], toIndex: number) {
  const before = target[toIndex - 1]?.position;
  const after = target[toIndex]?.position;
  const position = positionBetween(before, after);
  const rebalance =
    (before !== undefined && needsRebalance(before, position)) ||
    (after !== undefined && needsRebalance(position, after));
  return { position, rebalance };
}

/**
 * Hasil drop dnd-kit → kontainer & index tujuan (index dalam daftar tujuan tanpa item aktif).
 * `over` bisa id aktivitas atau id kontainer. Null bila tidak ada perubahan.
 */
export function resolveDrop(
  containers: Record<string, string[]>,
  activeId: string,
  overId: string,
): { container: string; index: number } | null {
  const find = (id: string) => Object.keys(containers).find((c) => containers[c].includes(id));
  const from = find(activeId);
  if (!from) return null;

  if (overId in containers) {
    const list = containers[overId].filter((id) => id !== activeId);
    if (overId === from) return null; // dijatuhkan di area kosong kontainer sendiri
    return { container: overId, index: list.length };
  }

  const to = find(overId);
  if (!to) return null;
  const overIndex = containers[to].indexOf(overId);
  if (to === from) {
    // Semantik arrayMove: item aktif berakhir di index item `over`.
    if (overIndex === containers[from].indexOf(activeId)) return null;
    return { container: to, index: overIndex };
  }
  return { container: to, index: overIndex };
}
