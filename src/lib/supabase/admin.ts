import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

export type AdminClient = SupabaseClient<Database>;

/** Service role — melewati RLS. Hanya untuk server; jangan pernah dipakai dengan input yang belum diotorisasi. */
export function createAdminClient(): AdminClient {
  const env = serverEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
