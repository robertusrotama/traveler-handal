import type { AdminClient } from "@/lib/supabase/admin";

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Rate limiter global berbasis Postgres (≤ 1 req / interval untuk seluruh app).
 * RPC `take_rate_limit_slot` mereservasi slot & mengembalikan ms yang harus ditunggu.
 */
export function createDbRateLimiter(
  admin: Pick<AdminClient, "rpc">,
  key = "nominatim",
  intervalMs = 1000,
  sleep = defaultSleep,
): () => Promise<void> {
  return async () => {
    const { data, error } = await admin.rpc("take_rate_limit_slot", { p_key: key, p_interval_ms: intervalMs });
    if (error) throw error;
    const wait = Number(data ?? 0);
    if (wait > 0) await sleep(wait);
  };
}
