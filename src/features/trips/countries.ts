// Daftar ringkas negara tujuan umum (ISO 3166-1 alpha-2) dengan nama Indonesia. Negara lain: opsi "Lainnya".
export const COUNTRIES = [
  ["SA", "Arab Saudi"],
  ["AU", "Australia"],
  ["NL", "Belanda"],
  ["PH", "Filipina"],
  ["HK", "Hong Kong"],
  ["IN", "India"],
  ["GB", "Inggris (Britania Raya)"],
  ["ID", "Indonesia"],
  ["IT", "Italia"],
  ["JP", "Jepang"],
  ["DE", "Jerman"],
  ["KH", "Kamboja"],
  ["KR", "Korea Selatan"],
  ["MY", "Malaysia"],
  ["EG", "Mesir"],
  ["FR", "Prancis"],
  ["NZ", "Selandia Baru"],
  ["SG", "Singapura"],
  ["ES", "Spanyol"],
  ["CH", "Swiss"],
  ["TW", "Taiwan"],
  ["TH", "Thailand"],
  ["CN", "Tiongkok"],
  ["TR", "Turki"],
  ["AE", "Uni Emirat Arab"],
  ["US", "Amerika Serikat"],
  ["VN", "Vietnam"],
].sort((a, b) => a[1].localeCompare(b[1], "id")) as [string, string][];

const NAMES = new Map(COUNTRIES);

/** Nama negara; kode di luar daftar memakai Intl (server) atau kode itu sendiri. */
export function countryName(code: string): string {
  const known = NAMES.get(code);
  if (known) return known;
  try {
    return new Intl.DisplayNames(["id"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
