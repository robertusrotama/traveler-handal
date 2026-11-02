import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Cek optimistis (redirect cepat). Otorisasi sebenarnya tetap di RLS + pengecekan di page/action.
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/trips" && !pathname.startsWith("/trips/")) return response;

  const toLogin = (reason?: string) => {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    if (reason) login.searchParams.set("reason", reason);
    const redirect = NextResponse.redirect(login);
    // Bawa cookie sesi yang baru di-refresh.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user) return toLogin();
  // Guest (anonim) boleh membuka trip yang diikuti, tapi tidak boleh membuat trip.
  if (user.is_anonymous && pathname === "/trips/new") return toLogin("guest");
  return response;
}

export const config = {
  matcher: [
    // Dikecualikan: halaman publik (join/login/auth/revoked), API, aset statis, manifest & service worker.
    "/((?!join|login|auth|api|revoked|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
