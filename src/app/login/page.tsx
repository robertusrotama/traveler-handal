import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleAlert, Info } from "lucide-react";
import { GoogleLoginButton } from "@/features/trips/components/google-login-button";
import { safeNext } from "@/features/trips/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Masuk" };

const MESSAGES: Record<string, { tone: "info" | "error"; text: string }> = {
  guest: { tone: "info", text: "Tamu belum bisa membuat trip. Masuk dengan Google untuk membuat trip sendiri." },
  auth: { tone: "error", text: "Login gagal atau dibatalkan. Coba lagi." },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(one(sp.next));
  const message = MESSAGES[one(sp.error) ?? one(sp.reason) ?? ""];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && !user.is_anonymous) redirect(next);

  return (
    <main id="konten" className="flex flex-1 items-center justify-center bg-surface-soft px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-hairline bg-canvas p-6 md:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-display-sm font-bold text-primary">Traveler Handal</p>
          <h1 className="text-display-lg text-ink">Masuk untuk mulai merencanakan</h1>
          <p className="text-body-md text-muted">
            AI menyusun draft itinerary, kamu dan teman merapikannya bersama.
          </p>
        </div>

        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={
              message.tone === "error"
                ? "flex gap-2 rounded-sm bg-error/10 p-3 text-body-sm text-error"
                : "flex gap-2 rounded-sm bg-primary-soft p-3 text-body-sm text-primary-active"
            }
          >
            {message.tone === "error" ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            )}
            {message.text}
          </p>
        )}

        <GoogleLoginButton next={next} />

        <p className="text-body-sm text-muted">
          Diundang teman? Buka link undangan dari mereka — tidak perlu akun.
        </p>
      </div>
    </main>
  );
}
