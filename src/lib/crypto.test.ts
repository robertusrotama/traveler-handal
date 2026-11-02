import { describe, expect, it } from "vitest";
import { generateInviteToken, hashInviteToken } from "./crypto";

describe("invite token", () => {
  it("32 byte base64url (43 karakter, tanpa padding) dan acak", () => {
    const a = generateInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateInviteToken()).not.toBe(a);
  });

  it("hash = sha256 hex lowercase (vektor NIST 'abc' + UTF-8)", async () => {
    expect(await hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    // Postgres: select encode(sha256(convert_to('é','utf8')),'hex')
    expect(await hashInviteToken("é")).toBe("4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c");
  });
});
