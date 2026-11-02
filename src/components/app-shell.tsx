import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Top nav + container halaman. `actions` = slot kanan (menu user, tombol).
 * Halaman full-bleed (mis. peta) bisa menimpa container lewat `className`, contoh `max-w-none px-0 py-0`.
 */
export function AppShell({
  actions,
  className,
  children,
}: {
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#konten"
        className="sr-only z-50 rounded-sm bg-canvas px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 md:h-20 md:px-6 lg:px-10">
          <Link
            href="/trips"
            className="inline-flex min-h-11 items-center text-display-sm font-bold text-primary"
          >
            Traveler Handal
          </Link>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>
      <main
        id="konten"
        className={cn(
          "mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-10",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
