import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Refresh sesi Supabase & tulis cookie baru ke response. Tidak melakukan redirect;
 * pemanggil (`src/proxy.ts`) memutuskan berdasarkan `user`. Bila pemanggil membuat
 * response lain (mis. redirect), salin cookie dari `response` agar sesi tidak hilang.
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // Jangan sisipkan kode di antara createServerClient dan getUser (pola resmi @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
