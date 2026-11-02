"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { decideClaim } from "../actions";

export type ClaimRow = { id: string; memberName: string; createdLabel: string };

function ClaimItem({ claim }: { claim: ClaimRow }) {
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await decideClaim(claim.id, approve);
      if (!r.ok) toast({ title: "Gagal memproses klaim", description: r.error, variant: "error" });
      else toast({ title: approve ? `Klaim sebagai ${claim.memberName} disetujui` : "Klaim ditolak" });
    });

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-title-md text-ink">Mengaku sebagai {claim.memberName}</span>
        <span className="text-body-sm text-muted">
          Diminta {claim.createdLabel}. Setujui hanya bila kamu yakin ini memang {claim.memberName} — sesi lamanya akan
          kehilangan akses.
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="min-h-11" loading={pending} onClick={() => decide(true)}>
          Setujui
        </Button>
        <Button size="sm" variant="secondary" className="min-h-11" disabled={pending} onClick={() => decide(false)}>
          Tolak
        </Button>
      </div>
    </li>
  );
}

export function PendingClaims({ claims }: { claims: ClaimRow[] }) {
  return (
    <ul className="divide-y divide-hairline">
      {claims.map((c) => (
        <ClaimItem key={c.id} claim={c} />
      ))}
    </ul>
  );
}
