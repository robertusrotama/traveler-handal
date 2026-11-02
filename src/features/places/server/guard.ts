import "server-only";
import type { User } from "@supabase/supabase-js";
import type { z } from "zod";
import { formatZodError } from "@/lib/schemas/itinerary";
import { createClient } from "@/lib/supabase/server";

export type UserClient = Awaited<ReturnType<typeof createClient>>;

/** Error dengan status HTTP; `message` aman ditampilkan (Bahasa Indonesia). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export type AuthedRequest<B> = { body: B; user: User; supabase: UserClient };

/** Auth (401) + validasi body zod (400); error lain → 500 generik tanpa detail internal. */
export function authedRoute<S extends z.ZodType>(
  schema: S,
  handler: (r: AuthedRequest<z.output<S>>) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new HttpError(401, "Sesi kamu berakhir. Silakan masuk lagi.", "unauthenticated");
      const parsed = schema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        return Response.json(
          { error: "Permintaan tidak valid.", code: "invalid_request", details: formatZodError(parsed.error) },
          { status: 400 },
        );
      }
      return await handler({ body: parsed.data, user, supabase });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
      console.error("[api/places]", (e as { message?: string })?.message ?? e);
      return Response.json({ error: "Terjadi kesalahan di server. Coba lagi.", code: "server_error" }, { status: 500 });
    }
  };
}

/** Member aktif trip (lewat RLS klien user). Bukan member / sudah dicabut → 404. */
export async function requireActiveMember(supabase: UserClient, tripId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Trip tidak ditemukan.", "not_found");
}
