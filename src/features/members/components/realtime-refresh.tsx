"use client";

import { useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Muat ulang data server saat member/klaim trip berubah (klaim baru, member baru join, dll.). */
export function RealtimeRefresh({ tripId }: { tripId: string }) {
  const router = useRouter();
  const uid = useId();

  useEffect(() => {
    const supabase = createClient();
    const filter = `trip_id=eq.${tripId}`;
    const channel = supabase
      .channel(`members-settings:${tripId}:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_claims", filter }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_members", filter }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, uid, router]);

  return null;
}
