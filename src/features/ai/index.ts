import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { AdminClient } from "@/lib/supabase/admin";
import { FakeGenerator } from "./fake";
import { GeminiGenerator } from "./gemini";
import type { ItineraryGenerator, OnAiCall } from "./generator";
import { quotaFromCount, type Quota } from "./quota";

export * from "./generator";
export * from "./types";
export * from "./quota";
export { buildTripContext, MAX_INSTRUCTION_CHARS, type TripContextSource } from "./context";
export { buildImportPrompt } from "./prompts";

/** `onCall` dipanggil untuk SETIAP panggilan provider (termasuk retry/gagal) → insert 1 baris ai_generations. */
export function getGenerator(onCall: OnAiCall): ItineraryGenerator {
  const env = serverEnv();
  if (env.AI_PROVIDER === "fake") return new FakeGenerator(onCall);
  return new GeminiGenerator({ apiKey: env.GEMINI_API_KEY, model: env.AI_MODEL, onCall });
}

/** Kuota harian per trip: baris ai_generations kind ≠ import dalam 24 jam terakhir. */
export async function checkQuota(admin: AdminClient, tripId: string, now = new Date()): Promise<Quota> {
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const { count, error } = await admin
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .neq("kind", "import")
    .gte("created_at", since);
  if (error) throw error;
  return quotaFromCount(count ?? 0, serverEnv().AI_DAILY_QUOTA_PER_TRIP);
}
