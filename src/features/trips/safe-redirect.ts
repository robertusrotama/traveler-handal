/**
 * Path internal yang aman untuk redirect setelah login (cegah open redirect).
 * Hanya path relatif yang diawali satu "/" — bukan "//host", "/\host", URL absolut, atau karakter kontrol.
 */
export function safeNext(next: string | null | undefined, fallback = "/trips"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) {
    return fallback;
  }
  // Lapis kedua: pastikan URL hasil resolusi tetap di origin yang sama.
  const base = "http://x.invalid";
  try {
    const url = new URL(next, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
