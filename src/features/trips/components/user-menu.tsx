"use client";

import { useTransition } from "react";
import type { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "../actions";

/** Menu akun untuk slot `actions` di `AppShell`. `user` dari `supabase.auth.getUser()` di server. */
export function UserMenu({ user }: { user: User }) {
  const [pending, startTransition] = useTransition();
  const meta = user.user_metadata ?? {};
  const name: string = user.is_anonymous ? "Tamu" : meta.full_name || meta.name || user.email || "Akun saya";
  const avatar: string | undefined = user.is_anonymous ? undefined : meta.avatar_url || meta.picture;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu akun: ${name}`}
        className="flex size-11 items-center justify-center rounded-full border border-hairline bg-canvas transition-shadow hover:shadow-card"
      >
        {avatar ? (
          // Avatar Google eksternal; next/image butuh remotePatterns yang tidak perlu untuk 32px.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-ink text-caption text-on-primary"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-title-sm text-ink">{name}</span>
          {!user.is_anonymous && user.email && <span className="truncate">{user.email}</span>}
          {user.is_anonymous && <span className="max-w-60">Sesi tamu. Setelah keluar, masuk lagi lewat link undangan.</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => signOut());
          }}
        >
          {pending ? <Spinner label={null} /> : <LogOut aria-hidden="true" />}
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
