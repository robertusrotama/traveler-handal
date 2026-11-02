import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it("meneruskan path internal beserta query & hash", () => {
    expect(safeNext("/trips/abc?generate=1")).toBe("/trips/abc?generate=1");
    expect(safeNext("/trips#x")).toBe("/trips#x");
  });

  it.each([
    null,
    undefined,
    "",
    "trips",
    "https://evil.com",
    "//evil.com",
    "//evil.com/trips",
    "/\\evil.com",
    "\\\\evil.com",
    "/\tevil",
    "/%0a/evil.com".replace("%0a", "\n"),
    "javascript:alert(1)",
  ])("menolak %j → fallback", (v) => {
    expect(safeNext(v)).toBe("/trips");
  });

  it("memakai fallback kustom", () => {
    expect(safeNext("https://evil.com", "/")).toBe("/");
  });

  it("menormalkan traversal tanpa keluar origin", () => {
    expect(safeNext("/../../trips")).toBe("/trips");
  });
});
