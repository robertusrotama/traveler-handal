import type { Database } from "@/types/database";

type ClaimStatus = Database["public"]["Enums"]["claim_status"];

export type ClaimState =
  | { phase: "waiting"; claimId: string; failures: number }
  | { phase: "approved" }
  // ditolak, kedaluwarsa, atau tidak ditemukan (my_claim_status → null) — hasil bagi user sama
  | { phase: "rejected" };

export type ClaimEvent = { type: "status"; status: ClaimStatus | null } | { type: "error" };

/** Setelah sekian kegagalan polling beruntun, UI menampilkan peringatan koneksi (polling tetap jalan). */
export const UNSTABLE_AFTER = 3;

export function claimReducer(state: ClaimState, event: ClaimEvent): ClaimState {
  if (state.phase !== "waiting") return state; // final
  if (event.type === "error") return { ...state, failures: state.failures + 1 };
  if (event.status === "pending") return state.failures ? { ...state, failures: 0 } : state;
  if (event.status === "approved") return { phase: "approved" };
  return { phase: "rejected" };
}
