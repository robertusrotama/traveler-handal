"use client";

import { useEffect } from "react";

/** Mendaftarkan `public/sw.js` (F10). Hanya di production — di dev SW mengganggu HMR. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Gagal daftar (mis. mode privat) → app tetap jalan tanpa offline.
    });
  }, []);
  return null;
}
