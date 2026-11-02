import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "./auth";

// Vercel Hobby: batas durasi fungsi — needs verification (lihat vault/07-Knowledge/Free-Tier-Limits.md).
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
// shortcut: maks 50 user anonim per run (cek + hapus satu per satu); naikkan / paginasi bila antrean menumpuk.
const ANON_BATCH = 50;

/** Kebersihan harian (Auth-and-Access §Kebersihan). Query klaim sekaligus menjadi keep-alive DB. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();

  // 1. Klaim pending > 7 hari → rejected (sama dengan aturan `decide_member_claim` / `my_claim_status`).
  const claims = await admin
    .from("member_claims")
    .update({ status: "rejected", decided_at: new Date(now).toISOString() })
    .eq("status", "pending")
    .lte("created_at", new Date(now - 7 * DAY_MS).toISOString())
    .select("id");
  if (claims.error) {
    console.error("cron cleanup: claims", claims.error.message);
    return NextResponse.json({ error: "claims_failed" }, { status: 500 });
  }

  // 2. User anonim > 30 hari tanpa keanggotaan aktif → hapus dari auth (cascade ke profiles & baris dicabut).
  const anon = await admin
    .from("profiles")
    .select("id")
    .eq("is_anonymous", true)
    .lt("created_at", new Date(now - 30 * DAY_MS).toISOString())
    .order("created_at")
    .limit(ANON_BATCH);
  if (anon.error) {
    console.error("cron cleanup: profiles", anon.error.message);
    return NextResponse.json({ error: "profiles_failed" }, { status: 500 });
  }

  let deletedUsers = 0;
  let failedUsers = 0;
  for (const { id } of anon.data) {
    // dicek per user (bukan daftar besar) agar hasil terpotong tidak pernah menghapus guest yang masih aktif
    const active = await admin
      .from("trip_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .is("revoked_at", null);
    if (active.error || active.count !== 0) {
      if (active.error) failedUsers++;
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) failedUsers++;
    else deletedUsers++;
  }

  return NextResponse.json({
    expiredClaims: claims.data.length,
    checkedAnonUsers: anon.data.length,
    deletedUsers,
    failedUsers,
  });
}
