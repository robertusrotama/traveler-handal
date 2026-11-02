"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "../errors";

/** "Amankan akunku": tautkan Google ke sesi tamu (user_id tetap). Hanya tampil untuk user anonim. */
export function SecureAccountButton() {
  const pathname = usePathname();
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setAnonymous(Boolean(data.user?.is_anonymous)));
  }, []);

  if (!anonymous) return null;

  async function link() {
    setLoading(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(pathname)}`;
    const { error } = await createClient().auth.linkIdentity({ provider: "google", options: { redirectTo } });
    // sukses → browser diarahkan ke Google, jadi state di bawah hanya untuk kasus gagal
    if (error) {
      setError(errorMessage(error));
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline p-4 md:p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-5"
        >
          <ShieldCheck />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-title-md text-ink">Amankan akunku</h3>
          <p className="text-body-sm text-body">
            Kamu masuk sebagai tamu, jadi akses hanya tersimpan di browser ini. Tautkan akun Google supaya bisa membuka
            trip dari perangkat lain dan tidak kehilangan akses bila data browser terhapus.
          </p>
        </div>
      </div>
      <div>
        <Button variant="secondary" onClick={link} loading={loading}>
          Tautkan akun Google
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
