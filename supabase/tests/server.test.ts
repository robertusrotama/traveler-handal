import { describe, expect, it } from "vitest";
import { createUser, tx } from "./helpers";

describe("take_rate_limit_slot", () => {
  it("panggilan beruntun diberi jarak ≈ interval", () =>
    tx(async (db) => {
      await db.as("service");
      const slot = async () =>
        (await db.one<{ wait: number }>("select public.take_rate_limit_slot('nominatim', 1000) as wait")).wait;
      expect(await slot()).toBe(0); // seed 'epoch'
      const second = await slot();
      expect(second).toBeGreaterThan(900);
      expect(second).toBeLessThanOrEqual(1000);
      const third = await slot();
      expect(third).toBeGreaterThan(1900);
      expect(third).toBeLessThanOrEqual(2000);
      // key baru dibuat otomatis
      expect((await db.one<{ wait: number }>("select public.take_rate_limit_slot('lain', 500) as wait")).wait).toBe(0);
      await db.fails("select public.take_rate_limit_slot('nominatim', -1)", [], /invalid_rate_limit_args/);
    }),
  );

  it("tidak bisa dipanggil authenticated / anon", () =>
    tx(async (db) => {
      const u = await createUser(db);
      for (const actor of [u, "anon"] as const) {
        await db.as(actor);
        await db.fails("select public.take_rate_limit_slot('nominatim', 1000)", [], /permission denied for function/);
      }
    }),
  );
});

describe("hak EXECUTE fungsi", () => {
  it("semua fungsi public dikunci; hanya yang di-whitelist untuk authenticated/anon", () =>
    tx(async (db) => {
      await db.as("admin");
      const rows = await db.query<{ fn: string; auth: boolean; anon: boolean; definer: boolean; cfg: string[] | null }>(`
        select p.proname as fn,
               has_function_privilege('authenticated', p.oid, 'execute') as auth,
               has_function_privilege('anon', p.oid, 'execute') as anon,
               p.prosecdef as definer, p.proconfig as cfg
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') order by 1`);
      const authFns = rows.filter((r) => r.auth).map((r) => r.fn);
      expect(authFns).toEqual([
        "create_trip", "decide_member_claim", "get_invite_preview", "is_trip_member", "is_trip_owner",
        "join_trip", "list_claimable_members", "my_claim_status", "rebalance_positions", "request_member_claim",
        "rotate_trip_invite", "update_trip_dates",
      ]);
      expect(rows.filter((r) => r.anon).map((r) => r.fn)).toEqual(["get_invite_preview"]);
      // search_path terkunci di semua fungsi
      for (const r of rows) expect(r.cfg, r.fn).toContain('search_path=""');
    }),
  );

  it("RLS aktif di setiap tabel public", () =>
    tx(async (db) => {
      const rows = await db.query<{ relname: string }>(
        "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
      );
      expect(rows).toEqual([]);
    }),
  );

  it("tabel realtime masuk publication supabase_realtime", () =>
    tx(async (db) => {
      const rows = await db.query<{ tablename: string }>(
        "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1",
      );
      expect(rows.map((r) => r.tablename)).toEqual(["activities", "days", "member_claims", "trip_members", "trips"]);
    }),
  );
});
