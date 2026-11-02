"use client";

import { useOptimistic, useTransition } from "react";
import { Crown, UserX } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import type { Tables } from "@/types/database";
import { setMemberAiAccess, setMemberRevoked } from "../actions";
import type { ActionResult } from "../actions";

export type MemberRow = Pick<
  Tables<"trip_members">,
  "id" | "user_id" | "display_name" | "role" | "can_use_ai" | "revoked_at"
> & { joinedLabel: string };

function useMemberAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast({ title: "Gagal menyimpan", description: r.error, variant: "error" });
      else if (success) toast({ title: success });
    });
  return { pending, run };
}

function MemberItem({
  tripId,
  member,
  isOwner,
  isSelf,
}: {
  tripId: string;
  member: MemberRow;
  isOwner: boolean;
  isSelf: boolean;
}) {
  const { pending, run } = useMemberAction();
  const [canUseAi, setCanUseAi] = useOptimistic(member.can_use_ai);
  const revoked = member.revoked_at !== null;
  const manageable = isOwner && member.role === "member";
  const switchId = `ai-${member.id}`;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={revoked ? "text-title-md text-muted line-through" : "text-title-md text-ink"}>
            {member.display_name}
          </span>
          {member.role === "owner" && (
            <Badge variant="primary">
              <Crown aria-hidden="true" />
              Owner
            </Badge>
          )}
          {isSelf && <Badge>Kamu</Badge>}
          {revoked && (
            <Badge>
              <UserX aria-hidden="true" />
              Dicabut
            </Badge>
          )}
        </div>
        <span className="text-body-sm text-muted">Bergabung {member.joinedLabel}</span>
      </div>

      {manageable && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {!revoked && (
            <div className="flex min-h-11 items-center gap-3">
              <Switch
                id={switchId}
                checked={canUseAi}
                disabled={pending}
                onCheckedChange={(v) =>
                  run(() => {
                    setCanUseAi(v);
                    return setMemberAiAccess(tripId, member.id, v);
                  })
                }
              />
              <label htmlFor={switchId} className="text-body-sm text-ink">
                Boleh pakai AI
              </label>
            </div>
          )}
          {revoked ? (
            <Button
              size="sm"
              variant="secondary"
              className="min-h-11"
              loading={pending}
              onClick={() => run(() => setMemberRevoked(tripId, member.id, false), "Akses diaktifkan lagi")}
            >
              Aktifkan lagi
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="min-h-11 text-error" loading={pending}>
                  Cabut akses
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cabut akses {member.display_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {member.display_name} langsung tidak bisa membuka trip ini lagi. Kamu bisa mengaktifkannya kembali
                    nanti.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => run(() => setMemberRevoked(tripId, member.id, true), "Akses dicabut")}
                  >
                    Cabut akses
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
      {!isOwner && member.role === "member" && member.can_use_ai && <Badge className="self-start">Boleh pakai AI</Badge>}
    </li>
  );
}

export function MemberList({
  tripId,
  members,
  isOwner,
  currentUserId,
}: {
  tripId: string;
  members: MemberRow[];
  isOwner: boolean;
  currentUserId: string;
}) {
  return (
    <ul className="divide-y divide-hairline">
      {members.map((m) => (
        <MemberItem key={m.id} tripId={tripId} member={m} isOwner={isOwner} isSelf={m.user_id === currentUserId} />
      ))}
    </ul>
  );
}
