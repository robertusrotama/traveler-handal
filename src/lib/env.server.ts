import "server-only";
import { z } from "zod";

const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    AI_PROVIDER: z.enum(["gemini", "fake"]).default("gemini"),
    GEMINI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
    AI_DAILY_QUOTA_PER_TRIP: z.coerce.number().int().positive().default(30),
    PLACES_PROVIDER: z.enum(["nominatim", "fake"]).default("nominatim"),
    NOMINATIM_USER_AGENT: z.string().min(1).default("TravelerHandal/0.1 (pribadi)"),
    NOMINATIM_EMAIL: z.string().optional(),
    CRON_SECRET: z.string().optional(),
  })
  .refine((e) => e.AI_PROVIDER !== "gemini" || !!e.GEMINI_API_KEY, {
    path: ["GEMINI_API_KEY"],
    message: "GEMINI_API_KEY wajib bila AI_PROVIDER=gemini",
  });

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/** Env server, divalidasi saat pertama dipakai (bukan saat build). */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  // `KEY=` kosong di .env diperlakukan sebagai tidak diisi agar default berlaku.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new Error(`Env server tidak valid: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return (cached = r.data);
}
