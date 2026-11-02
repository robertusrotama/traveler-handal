// Token undangan = 32 byte base64url (lihat `@/lib/crypto`). Bentuk lain ditolak tanpa query DB.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isInviteTokenShape(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** URL undangan dibangun di client dari `window.location.origin` (bukan header Host yang bisa dipalsukan). */
export function buildInviteUrl(origin: string, token: string): string {
  if (!isInviteTokenShape(token)) throw new Error("Token undangan tidak valid");
  return `${new URL(origin).origin}/join/${token}`;
}

/**
 * `expires_at` = awal hari (UTC) end_date + 8, jadi hari terakhir link berlaku = end_date + 7.
 * Tampilkan tanggal hari terakhir itu (UTC) agar sama dengan aturan [[ADR-0008]].
 */
export function formatInviteExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(Date.parse(expiresAt) - 1),
  );
}

/** Rentang tanggal trip dari kolom `date` (YYYY-MM-DD), mis. "3–7 Des 2026". */
export function formatTripDates(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return fmt.formatRange(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`));
}

// shortcut: zona waktu tetap WIB, ganti ke zona waktu pengguna bila ada pengguna di luar WIB.
export function formatDateTime(iso: string, withTime = false): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}
