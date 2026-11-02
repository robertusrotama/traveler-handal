/** Kunci cache geocode: lowercase, trim, tanda baca berlebih dibuang, spasi/koma dirapikan. */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s,'&-]+/gu, " ")
    .replace(/\s*,[\s,]*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .slice(0, 300);
}

/** Tambahkan kota ke query bila belum disebut. */
export function withCity(query: string, city: string): string {
  const q = query.trim();
  return city && !q.toLowerCase().includes(city.trim().toLowerCase()) ? `${q}, ${city.trim()}` : q;
}
