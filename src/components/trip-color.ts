// Pengganti foto di kartu trip dashboard (Design-System "Adaptasi"): gradien lembut, deterministik per id.
// Semua pasangan cukup terang agar teks `ink` di atasnya tetap kontras AA.
const PALETTE = [
  ["#dbeafe", "#eff6ff"], // biru
  ["#e0f2fe", "#f0f9ff"], // langit
  ["#ccfbf1", "#f0fdfa"], // teal
  ["#dcfce7", "#f0fdf4"], // hijau
  ["#fef3c7", "#fffbeb"], // kuning
  ["#ffedd5", "#fff7ed"], // jingga
  ["#ffe4e6", "#fff1f2"], // mawar
  ["#ede9fe", "#f5f3ff"], // ungu
] as const;

function hash(s: string) {
  let h = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pakai: `style={{ backgroundImage: tripGradient(trip.id) }}`. */
export function tripGradient(id: string) {
  const [from, to] = PALETTE[hash(id) % PALETTE.length];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
