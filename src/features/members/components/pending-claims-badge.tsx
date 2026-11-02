"use client";

import { useEffect, useId } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Jumlah klaim identitas yang menunggu keputusan owner. Tidak merender apa pun untuk non-owner / nol. */
export function PendingClaimsBadge({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const uid = useId();
  const queryKey = ["pending-claims", tripId];

  const { data: count = 0 } = useQuery({
    queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;
      // RLS: owner melihat semua klaim trip; user lain hanya klaim miliknya (dikecualikan di sini).
      const { count, error } = await supabase
        .from("member_claims")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .eq("status", "pending")
        .neq("claimant_user_id", user.id)
        .gt("created_at", new Date(Date.now() - CLAIM_TTL_MS).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pending-claims:${tripId}:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_claims", filter: `trip_id=eq.${tripId}` },
        () => queryClient.invalidateQueries({ queryKey: ["pending-claims", tripId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, uid, queryClient]);

  if (!count) return null;

  return (
    <Link
      href={`/trips/${tripId}/settings#klaim`}
      className={cn(badgeVariants({ variant: "primary" }), "min-h-11 px-3 underline-offset-2 hover:underline")}
    >
      <UserCheck aria-hidden="true" />
      {count} klaim menunggu
    </Link>
  );
}
