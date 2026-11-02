import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: () => ({ CRON_SECRET: "rahasia" }) }));
const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

import { isCronAuthorized } from "./auth";
import { GET } from "./route";

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/cleanup", { headers: auth ? { authorization: auth } : {} });

describe("isCronAuthorized", () => {
  it("menerima Bearer secret yang tepat", () => {
    expect(isCronAuthorized("Bearer rahasia", "rahasia")).toBe(true);
  });
  it("menolak secret salah, tanpa header, atau secret server kosong", () => {
    expect(isCronAuthorized("Bearer salah", "rahasia")).toBe(false);
    expect(isCronAuthorized("rahasia", "rahasia")).toBe(false);
    expect(isCronAuthorized(null, "rahasia")).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
  });
});

// Builder PostgREST tiruan: setiap method chain mengembalikan dirinya; `await` → hasil per tabel.
function fakeAdmin(results: Record<string, unknown[]>, deleteUser = vi.fn(async () => ({ error: null }))) {
  const from = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["update", "select", "eq", "lte", "lt", "order", "limit", "is"]) q[m] = () => q;
    q.then = (resolve: (v: unknown) => void) => resolve(results[table].shift());
    return q;
  };
  return { from, auth: { admin: { deleteUser } } };
}

describe("GET /api/cron/cleanup", () => {
  beforeEach(() => createAdminClient.mockReset());

  it("401 tanpa Authorization yang benar dan tidak menyentuh DB", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer salah"))).status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("menghapus hanya user anonim tanpa keanggotaan aktif", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    createAdminClient.mockReturnValue(
      fakeAdmin(
        {
          member_claims: [{ data: [{ id: "c1" }, { id: "c2" }], error: null }],
          profiles: [{ data: [{ id: "u-aktif" }, { id: "u-yatim" }], error: null }],
          trip_members: [
            { count: 1, error: null },
            { count: 0, error: null },
          ],
        },
        deleteUser,
      ),
    );
    const res = await GET(req("Bearer rahasia"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ expiredClaims: 2, checkedAnonUsers: 2, deletedUsers: 1, failedUsers: 0 });
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith("u-yatim");
  });

  it("tidak menghapus bila cek keanggotaan gagal", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    createAdminClient.mockReturnValue(
      fakeAdmin(
        {
          member_claims: [{ data: [], error: null }],
          profiles: [{ data: [{ id: "u1" }], error: null }],
          trip_members: [{ count: null, error: { message: "boom" } }],
        },
        deleteUser,
      ),
    );
    const body = await (await GET(req("Bearer rahasia"))).json();
    expect(body).toMatchObject({ deletedUsers: 0, failedUsers: 1 });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
