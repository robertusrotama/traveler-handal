"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { generateInviteToken, hashInviteToken } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "./errors";

// Server Action = endpoint publik: validasi input di sini; otorisasi ditegakkan RLS/RPC (owner saja).
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const id = z.uuid();
const fail = (error: string) => ({ ok: false as const, error });
const INVALID = "Permintaan tidak valid.";

/** Buat/reset link undangan. Token mentah hanya dikembalikan sekali ke owner; DB menyimpan hash-nya. */
export async function createInviteLink(
  tripId: string,
): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  if (!id.safeParse(tripId).success) return fail(INVALID);
  const supabase = await createClient();
  const token = generateInviteToken();
  const { data: inviteId, error } = await supabase.rpc("rotate_trip_invite", {
    p_trip_id: tripId,
    p_token_hash: await hashInviteToken(token),
  });
  if (error) return fail(errorMessage(error));
  const { data: invite } = await supabase.from("trip_invites").select("expires_at").eq("id", inviteId).single();
  if (!invite) return fail(errorMessage(null));
  return { ok: true, token, expiresAt: invite.expires_at };
}

type MemberPatch = { can_use_ai: boolean } | { revoked_at: string | null };

async function updateMember(tripId: string, memberId: string, patch: MemberPatch): Promise<ActionResult> {
  const supabase = await createClient();
  // Hanya kolom yang berubah (column-level grant). RLS: hanya owner; baris owner dikecualikan.
  const { data, error } = await supabase
    .from("trip_members")
    .update(patch)
    .eq("id", memberId)
    .eq("trip_id", tripId)
    .eq("role", "member")
    .select("id");
  if (error) return fail(errorMessage(error));
  if (!data.length) return fail(errorMessage({ message: "forbidden" }));
  refresh();
  return { ok: true };
}

export async function setMemberAiAccess(tripId: string, memberId: string, canUseAi: boolean): Promise<ActionResult> {
  if (!id.safeParse(tripId).success || !id.safeParse(memberId).success || typeof canUseAi !== "boolean") {
    return fail(INVALID);
  }
  return updateMember(tripId, memberId, { can_use_ai: canUseAi });
}

export async function setMemberRevoked(tripId: string, memberId: string, revoked: boolean): Promise<ActionResult> {
  if (!id.safeParse(tripId).success || !id.safeParse(memberId).success || typeof revoked !== "boolean") {
    return fail(INVALID);
  }
  return updateMember(tripId, memberId, { revoked_at: revoked ? new Date().toISOString() : null });
}

export async function decideClaim(claimId: string, approve: boolean): Promise<ActionResult> {
  if (!id.safeParse(claimId).success || typeof approve !== "boolean") return fail(INVALID);
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_member_claim", { p_claim_id: claimId, p_approve: approve });
  if (error) return fail(errorMessage(error));
  refresh();
  return { ok: true };
}
