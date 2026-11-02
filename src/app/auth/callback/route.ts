import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/features/trips/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// OAuth code exchange (PKCE). `next` hanya path relatif internal (anti open redirect).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    console.error("auth/callback", error.message);
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("error", "auth");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
