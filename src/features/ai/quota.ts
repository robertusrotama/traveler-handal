export type Quota = { used: number; limit: number; remaining: number };

export function quotaFromCount(used: number, limit: number): Quota {
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/** Owner selalu boleh; member aktif hanya bila `can_use_ai`. */
export function canUseAi(
  member: { role: "owner" | "member"; can_use_ai: boolean; revoked_at: string | null } | null | undefined,
): boolean {
  return !!member && member.revoked_at === null && (member.role === "owner" || member.can_use_ai);
}
