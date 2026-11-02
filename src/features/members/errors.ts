// Kode error RPC (error.message) & Auth (error.code) → teks Indonesia.
// `message` mentah tidak pernah ditampilkan (bisa berisi teks Postgres berbahasa Inggris).
const MESSAGES: Record<string, string> = {
  invite_invalid: "Link undangan tidak valid, sudah kedaluwarsa, atau sudah direset.",
  access_revoked: "Akses kamu ke trip ini sudah dicabut.",
  forbidden: "Kamu tidak punya izin untuk tindakan ini.",
  not_authenticated: "Sesi kamu berakhir. Muat ulang halaman ini.",
  invalid_display_name: "Nama harus 1–40 karakter.",
  already_member: "Kamu sudah menjadi member trip ini.",
  member_not_claimable: "Member ini tidak bisa diklaim.",
  claim_already_decided: "Klaim ini sudah diputuskan.",
  claim_expired: "Klaim sudah kedaluwarsa (lebih dari 7 hari).",
  claimant_already_member: "Pengklaim sudah menjadi member trip ini.",
  // unique violation saat mengaktifkan lagi member yang sudah aktif lewat sesi lain
  "23505": "Member ini sudah aktif lewat sesi lain.",
  // Supabase Auth
  captcha_failed: "Verifikasi keamanan gagal. Ulangi verifikasinya lalu coba lagi.",
  over_request_rate_limit: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
  anonymous_provider_disabled: "Join tanpa akun sedang tidak tersedia. Masuk dengan Google untuk bergabung.",
  manual_linking_disabled: "Fitur tautkan akun belum diaktifkan di server. Coba lagi nanti.",
  identity_already_exists: "Akun Google ini sudah terhubung ke akun lain. Pakai akun Google yang berbeda.",
  provider_disabled: "Login Google sedang tidak tersedia. Coba lagi nanti.",
};

export const GENERIC_ERROR = "Terjadi kesalahan. Coba lagi.";

type ErrorLike = { message?: string; hint?: string | null; code?: string } | null | undefined;

export function errorCode(err: ErrorLike): string | undefined {
  if (!err) return undefined;
  if (err.message && err.message in MESSAGES) return err.message;
  if (err.code && err.code in MESSAGES) return err.code;
  return err.message || err.code;
}

export function errorMessage(err: ErrorLike): string {
  const code = errorCode(err);
  if (code && code in MESSAGES) return MESSAGES[code];
  // hint dari RPC kita selalu Bahasa Indonesia
  return err?.hint || GENERIC_ERROR;
}
