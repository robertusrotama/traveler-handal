import { createHash, timingSafeEqual } from "node:crypto";

/** Vercel Cron mengirim `Authorization: Bearer ${CRON_SECRET}`. Secret kosong → selalu ditolak. */
export function isCronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  // hash dulu agar panjang sama → timingSafeEqual tidak membocorkan panjang secret
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}
