"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, RefreshCw, Share2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { createInviteLink } from "../actions";
import { buildInviteUrl, formatInviteExpiry } from "../invite";

export function InvitePanel({
  tripId,
  tripTitle,
  activeExpiresAt,
}: {
  tripId: string;
  tripTitle: string;
  /** `expires_at` undangan aktif, null bila belum ada / kedaluwarsa. */
  activeExpiresAt: string | null;
}) {
  // URL penuh hanya hidup di state komponen ini; tidak disimpan & tidak dikirim ke mana pun.
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(activeExpiresAt);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function rotate() {
    startTransition(async () => {
      const r = await createInviteLink(tripId);
      if (!r.ok) {
        toast({ title: "Gagal membuat link", description: r.error, variant: "error" });
        return;
      }
      setUrl(buildInviteUrl(window.location.origin, r.token));
      setExpiresAt(r.expiresAt);
      setCopied(false);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link disalin" });
    } catch {
      toast({ title: "Tidak bisa menyalin otomatis", description: "Tekan lama link lalu salin manual.", variant: "error" });
    }
  }

  async function share() {
    if (!url) return;
    try {
      await navigator.share({ title: tripTitle, text: `Gabung ke trip "${tripTitle}" di Traveler Handal`, url });
    } catch {
      // dibatalkan user — tidak perlu pesan
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {url ? (
        <div className="flex flex-col gap-3 rounded-md border border-primary bg-primary-soft p-4">
          <Label htmlFor="invite-url">Link undangan baru</Label>
          <Input
            id="invite-url"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-12 font-mono text-body-sm"
          />
          <p className="text-body-sm font-medium text-ink" role="status">
            Link hanya ditampilkan sekali; simpan atau bagikan sekarang.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={copy}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Tersalin" : "Salin link"}
            </Button>
            {canShare && (
              <Button size="sm" variant="secondary" onClick={share}>
                <Share2 aria-hidden="true" />
                Bagikan
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-body-md text-body">
          {expiresAt
            ? "Link undangan aktif. Demi keamanan, link hanya ditampilkan sekali saat dibuat — kalau belum tersimpan, buat link baru dengan Reset link."
            : "Belum ada link undangan aktif. Buat link lalu kirim ke teman agar mereka bisa bergabung."}
        </p>
      )}

      {expiresAt && (
        <p className="text-body-sm text-muted">Link berlaku sampai {formatInviteExpiry(expiresAt)}.</p>
      )}

      <div>
        {expiresAt ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" loading={pending}>
                <RefreshCw aria-hidden="true" />
                Reset link
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset link undangan?</AlertDialogTitle>
                <AlertDialogDescription>
                  Link lama langsung tidak berlaku. Teman yang belum bergabung harus memakai link baru. Member yang
                  sudah bergabung tidak terpengaruh.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={rotate}>Reset link</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button onClick={rotate} loading={pending}>
            <Link2 aria-hidden="true" />
            Buat link undangan
          </Button>
        )}
      </div>
    </div>
  );
}
