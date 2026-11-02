import { describe, expect, it } from "vitest";
import { generateInviteToken } from "@/lib/crypto";
import { claimReducer, type ClaimState } from "./claim-state";
import { errorCode, errorMessage, GENERIC_ERROR } from "./errors";
import { buildInviteUrl, formatInviteExpiry, formatTripDates, isInviteTokenShape } from "./invite";

describe("buildInviteUrl", () => {
  const token = generateInviteToken();

  it("memakai origin saja (path/query/hash origin dibuang)", () => {
    expect(buildInviteUrl("https://app.example.com", token)).toBe(`https://app.example.com/join/${token}`);
    expect(buildInviteUrl("http://localhost:3000/trips/x?a=1#b", token)).toBe(`http://localhost:3000/join/${token}`);
  });

  it("menolak token yang bukan 32 byte base64url", () => {
    expect(() => buildInviteUrl("https://a.b", "../../evil")).toThrow();
    expect(() => buildInviteUrl("https://a.b", `${token}x`)).toThrow();
    expect(isInviteTokenShape(token)).toBe(true);
    expect(isInviteTokenShape("a".repeat(42))).toBe(false);
    expect(isInviteTokenShape("a".repeat(42) + "=")).toBe(false);
  });
});

describe("format tanggal", () => {
  it("expiry = hari terakhir berlaku (end_date + 7), bukan tengah malam berikutnya", () => {
    // end_date 2026-12-10 → expires_at 2026-12-18T00:00Z → berlaku s.d. 17 Desember
    expect(formatInviteExpiry("2026-12-18T00:00:00+00:00")).toBe("17 Desember 2026");
  });

  it("rentang tanggal trip tidak bergeser zona waktu", () => {
    expect(formatTripDates("2026-12-03", "2026-12-07")).toMatch(/^3\s*–\s*7 Des 2026$/);
    expect(formatTripDates("2026-12-03", "2026-12-03")).toBe("3 Des 2026");
  });
});

describe("errorMessage", () => {
  it("kode RPC di message → teks Indonesia", () => {
    expect(errorMessage({ message: "access_revoked", hint: "x" })).toBe("Akses kamu ke trip ini sudah dicabut.");
    expect(errorCode({ message: "invite_invalid" })).toBe("invite_invalid");
  });

  it("kode Auth di code → teks Indonesia; message Inggris tidak bocor", () => {
    const e = { message: "captcha protection: request disallowed (timeout-or-duplicate)", code: "captcha_failed" };
    expect(errorCode(e)).toBe("captcha_failed");
    expect(errorMessage(e)).toMatch(/Verifikasi keamanan gagal/);
    expect(errorMessage({ message: "Manual linking is disabled", code: "manual_linking_disabled" })).toMatch(
      /tautkan akun belum diaktifkan/,
    );
  });

  it("kode tak dikenal → hint RPC, lalu pesan umum", () => {
    expect(errorMessage({ message: "invalid_dates", hint: "Tanggal salah." })).toBe("Tanggal salah.");
    expect(errorMessage({ message: "permission denied for table trips", code: "42501" })).toBe(GENERIC_ERROR);
    expect(errorMessage(null)).toBe(GENERIC_ERROR);
    expect(errorMessage({ message: "", code: "23505" })).toMatch(/sudah aktif/);
  });
});

describe("claimReducer", () => {
  const waiting: ClaimState = { phase: "waiting", claimId: "c1", failures: 0 };

  it("pending tetap menunggu dan mereset hitungan gagal", () => {
    expect(claimReducer(waiting, { type: "status", status: "pending" })).toBe(waiting);
    const failed = claimReducer(claimReducer(waiting, { type: "error" }), { type: "error" });
    expect(failed).toEqual({ ...waiting, failures: 2 });
    expect(claimReducer(failed, { type: "status", status: "pending" })).toEqual(waiting);
  });

  it("approved / rejected / null (tidak ditemukan) adalah status akhir", () => {
    expect(claimReducer(waiting, { type: "status", status: "approved" })).toEqual({ phase: "approved" });
    expect(claimReducer(waiting, { type: "status", status: "rejected" })).toEqual({ phase: "rejected" });
    expect(claimReducer(waiting, { type: "status", status: null })).toEqual({ phase: "rejected" });
    const done = { phase: "approved" } as const;
    expect(claimReducer(done, { type: "status", status: "rejected" })).toBe(done);
    expect(claimReducer(done, { type: "error" })).toBe(done);
  });
});
