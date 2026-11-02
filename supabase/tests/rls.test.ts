import { describe, expect, it } from "vitest";
import { createTrip, createUser, tx, world } from "./helpers";

type Role = "owner" | "member" | "guest" | "revoked" | "outsider";
const ROLES: [Role, boolean][] = [
  ["owner", true],
  ["member", true],
  ["guest", true],
  ["revoked", false],
  ["outsider", false],
];

describe("RLS SELECT per peran (trip-scoped)", () => {
  it.each(ROLES)("%s → terlihat: %s", (role, visible) =>
    tx(async (db) => {
      const w = await world(db);
      await db.as("service");
      await db.query(
        "insert into public.ai_generations (trip_id, requested_by, kind, provider, model, status) values ($1, $2, 'outline', 'fake', 'fake-1', 'success')",
        [w.tripId, w.owner.id],
      );
      await db.as(w[role]);
      const count = async (table: string, col = "trip_id") =>
        (await db.query(`select 1 from public.${table} where ${col} = $1`, [w.tripId])).length;

      expect(await count("trips", "id")).toBe(visible ? 1 : 0);
      expect(await count("days")).toBe(visible ? 3 : 0);
      expect(await count("activities")).toBe(visible ? 1 : 0);
      expect(await count("ai_generations")).toBe(visible ? 1 : 0);
      // member aktif melihat semua 4 baris (owner + 3 join); yang dicabut hanya baris dirinya
      expect(await count("trip_members")).toBe(visible ? 4 : role === "revoked" ? 1 : 0);
      expect(await count("trip_invites")).toBe(role === "owner" ? 1 : 0);
    }),
  );

  it("anon (tanpa sesi) tidak punya akses tabel sama sekali", () =>
    tx(async (db) => {
      await world(db);
      await db.as("anon");
      for (const t of ["trips", "trip_members", "trip_invites", "member_claims", "days", "activities", "ai_generations", "places", "geocode_cache", "rate_limits", "profiles"]) {
        await db.fails(`select 1 from public.${t}`, [], /permission denied/);
      }
    }),
  );

  it("revoked member: semua tulis ke trip ditolak/terfilter", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.revoked);
      expect(await db.affected("update public.activities set title = 'x' where id = $1", [w.activityId])).toBe(0);
      expect(await db.affected("delete from public.activities where id = $1", [w.activityId])).toBe(0);
      expect(await db.affected("update public.days set title = 'x' where trip_id = $1", [w.tripId])).toBe(0);
      await db.fails(
        "insert into public.activities (trip_id, position, title, category) values ($1, 1, 'x', 'alam')",
        [w.tripId],
        /row-level security/,
      );
    }),
  );
});

describe("trips", () => {
  it("owner boleh ubah info & arsip; member tidak; tanggal hanya via RPC", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.member);
      expect(await db.affected("update public.trips set title = 'Hack' where id = $1", [w.tripId])).toBe(0);
      expect(await db.affected("delete from public.trips where id = $1", [w.tripId])).toBe(0);
      await db.as(w.owner);
      expect(await db.affected("update public.trips set title = 'Baru', status = 'archived' where id = $1", [w.tripId])).toBe(1);
      await db.fails("update public.trips set start_date = '2027-01-01' where id = $1", [w.tripId], /permission denied/);
      await db.fails("update public.trips set owner_id = $2 where id = $1", [w.tripId, w.member.id], /permission denied/);
    }),
  );

  it("insert langsung ditolak (wajib lewat create_trip)", () =>
    tx(async (db) => {
      const u = await createUser(db, { name: "A" });
      await db.as(u);
      await db.fails(
        "insert into public.trips (owner_id, title, country_code, cities, start_date, end_date, travelers_count) values ($1, 't', 'ID', '{Bali}', '2027-01-01', '2027-01-02', 1)",
        [u.id],
        /row-level security/,
      );
    }),
  );

  it("owner bisa hapus trip (cascade ke days/activities/members)", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.owner);
      expect(await db.affected("delete from public.trips where id = $1", [w.tripId])).toBe(1);
      await db.as("admin");
      expect(await db.query("select 1 from public.activities where trip_id = $1", [w.tripId])).toHaveLength(0);
    }),
  );
});

describe("trip_members", () => {
  it("owner mengatur izin AI & mencabut; member tidak bisa", () =>
    tx(async (db) => {
      const w = await world(db);
      const { id: budi } = await w.memberRow(w.member.id);
      await db.as(w.member);
      expect(await db.affected("update public.trip_members set can_use_ai = true where id = $1", [budi])).toBe(0);
      await db.as(w.owner);
      expect(await db.affected("update public.trip_members set can_use_ai = true where id = $1", [budi])).toBe(1);
      expect(await db.affected("update public.trip_members set revoked_at = now() where id = $1", [budi])).toBe(1);
      await db.fails("update public.trip_members set display_name = 'x' where id = $1", [budi], /permission denied/);
      await db.fails("update public.trip_members set user_id = $2 where id = $1", [budi, w.owner.id], /permission denied/);
    }),
  );

  it("baris owner tidak bisa dicabut dan can_use_ai tetap true", () =>
    tx(async (db) => {
      const w = await world(db);
      const { id: ownerRow } = await w.memberRow(w.owner.id);
      await db.as(w.owner);
      await db.fails("update public.trip_members set revoked_at = now() where id = $1", [ownerRow], /trip_members_owner_check/);
      await db.fails("update public.trip_members set can_use_ai = false where id = $1", [ownerRow], /trip_members_owner_check/);
    }),
  );

  it("insert/delete langsung tidak bisa", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.owner);
      await db.fails(
        "insert into public.trip_members (trip_id, user_id, display_name) values ($1, $2, 'x')",
        [w.tripId, w.outsider.id],
        /row-level security/,
      );
      expect(await db.affected("delete from public.trip_members where trip_id = $1", [w.tripId])).toBe(0);
    }),
  );

  it("tepat satu owner & satu baris aktif per user per trip (constraint)", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as("admin");
      await db.fails(
        "insert into public.trip_members (trip_id, user_id, display_name, role, can_use_ai) values ($1, $2, 'x', 'owner', true)",
        [w.tripId, w.outsider.id],
        /trip_members_one_owner_key/,
      );
      await db.fails(
        "insert into public.trip_members (trip_id, user_id, display_name) values ($1, $2, 'x')",
        [w.tripId, w.member.id],
        /trip_members_active_user_key/,
      );
    }),
  );
});

describe("trip_invites", () => {
  it("hanya owner yang bisa menulis", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.member);
      await db.fails(
        "insert into public.trip_invites (trip_id, token_hash, created_by, expires_at) values ($1, repeat('a', 64), $2, now())",
        [w.tripId, w.member.id],
        /row-level security/,
      );
      expect(await db.affected("update public.trip_invites set revoked_at = now() where trip_id = $1", [w.tripId])).toBe(0);
      await db.as(w.owner);
      expect(await db.affected("update public.trip_invites set revoked_at = now() where trip_id = $1", [w.tripId])).toBe(1);
    }),
  );
});

describe("days", () => {
  it("member boleh ubah tema/kota/catatan, tidak boleh date/day_index/trip_id", () =>
    tx(async (db) => {
      const w = await world(db);
      const day = w.days[0].id;
      for (const actor of [w.member, w.guest]) {
        await db.as(actor);
        expect(await db.affected("update public.days set title = 'Kuil', city = 'Kyoto', notes = 'n' where id = $1", [day])).toBe(1);
        await db.fails("update public.days set date = '2030-01-01' where id = $1", [day], /permission denied/);
        await db.fails("update public.days set day_index = 9 where id = $1", [day], /permission denied/);
        await db.fails("update public.days set trip_id = gen_random_uuid() where id = $1", [day], /permission denied/);
      }
      await db.as(w.outsider);
      expect(await db.affected("update public.days set title = 'x' where id = $1", [day])).toBe(0);
    }),
  );

  it("insert/delete langsung ditolak bahkan untuk owner", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.owner);
      await db.fails(
        "insert into public.days (trip_id, day_index, date) values ($1, 5, '2027-03-06')",
        [w.tripId],
        /row-level security/,
      );
      expect(await db.affected("delete from public.days where trip_id = $1", [w.tripId])).toBe(0);
    }),
  );
});

describe("activities", () => {
  it("member & guest CRUD; created_by/updated_by dari sesi", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.guest);
      const a = await db.one<{ id: string; created_by: string }>(
        "insert into public.activities (trip_id, day_id, position, title, category, created_by) values ($1, $2, 2048, 'Ramen', 'kuliner', $3) returning id, created_by",
        [w.tripId, w.days[1].id, w.owner.id],
      );
      expect(a.created_by).toBe(w.guest.id);
      await db.as(w.member);
      const u = await db.one<{ updated_by: string }>(
        "update public.activities set title = 'Ramen Ichiran', day_id = null where id = $1 returning updated_by",
        [a.id],
      );
      expect(u.updated_by).toBe(w.member.id);
      expect(await db.affected("delete from public.activities where id = $1", [a.id])).toBe(1);
      await db.as(w.outsider);
      expect(await db.affected("update public.activities set title = 'x' where id = $1", [w.activityId])).toBe(0);
      expect(await db.query("select 1 from public.activities where id = $1", [w.activityId])).toHaveLength(0);
    }),
  );

  it("tidak bisa memindah aktivitas ke trip lain", () =>
    tx(async (db) => {
      const w = await world(db);
      const otherTrip = await createTrip(db, w.member, { title: "Trip lain" });
      const otherDay = (await db.one<{ id: string }>("select id from public.days where trip_id = $1 and day_index = 0", [otherTrip])).id;
      await db.as(w.member); // member di kedua trip
      await db.fails("update public.activities set trip_id = $2 where id = $1", [w.activityId, otherTrip], /permission denied/);
      // day_id harus milik trip yang sama (composite FK)
      await db.fails("update public.activities set day_id = $2 where id = $1", [w.activityId, otherDay], /activities_trip_id_day_id_fkey/);
      await db.fails(
        "insert into public.activities (trip_id, day_id, position, title, category) values ($1, $2, 1, 'x', 'alam')",
        [w.tripId, otherDay],
        /activities_trip_id_day_id_fkey/,
      );
      // trip yang bukan miliknya
      await db.as(w.outsider);
      await db.fails(
        "insert into public.activities (trip_id, position, title, category) values ($1, 1, 'x', 'alam')",
        [w.tripId],
        /row-level security/,
      );
    }),
  );

  it("constraint: why ≤ 200, search_query wajib untuk ai/import, verified butuh place", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.member);
      const ins = "insert into public.activities (trip_id, position, title, category, why, source, search_query, verification_status) values ($1, 1, 'x', 'alam', $2, $3, $4, $5)";
      await db.fails(ins, [w.tripId, "a".repeat(201), "manual", null, "none"], /check constraint/);
      await db.fails(ins, [w.tripId, null, "ai", null, "none"], /activities_ai_search_query_check/);
      await db.fails(ins, [w.tripId, null, "manual", null, "verified"], /activities_verified_place_check/);
      await db.query(ins, [w.tripId, "a".repeat(200), "ai", "Sensoji Asakusa", "unverified"]);
    }),
  );

  it("hari dihapus langsung (admin) → aktivitas jatuh ke pool, tidak hilang", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as("admin");
      await db.query("delete from public.days where id = $1", [w.days[0].id]);
      const a = await db.one<{ day_id: string | null }>("select day_id from public.activities where id = $1", [w.activityId]);
      expect(a.day_id).toBeNull();
    }),
  );
});

describe("tabel server-only", () => {
  it("ai_generations / places / geocode_cache / rate_limits: authenticated tidak bisa menulis", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.owner);
      await db.fails(
        "insert into public.ai_generations (trip_id, kind, provider) values ($1, 'outline', 'fake')",
        [w.tripId],
        /permission denied/,
      );
      await db.fails(
        "insert into public.places (provider, provider_place_id, name, lat, lng) values ('osm', 'n1', 'x', 0, 0)",
        [],
        /permission denied/,
      );
      await db.fails("insert into public.geocode_cache (query_normalized, country_code) values ('x', 'JP')", [], /permission denied/);
      await db.fails("select * from public.rate_limits", [], /permission denied/);
      await db.fails("update public.rate_limits set last_request_at = now()", [], /permission denied/);
    }),
  );

  it("service_role menulis; authenticated membaca places & geocode_cache", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as("service");
      const { id } = await db.one<{ id: string }>(
        "insert into public.places (provider, provider_place_id, name, lat, lng) values ('osm', 'node123', 'Sensoji', 35.71, 139.79) returning id",
      );
      await db.query("insert into public.geocode_cache (query_normalized, country_code, place_id) values ('sensoji asakusa', 'JP', $1)", [id]);
      await db.query("insert into public.geocode_cache (query_normalized, country_code) values ('tidak ada', 'JP')");
      await db.fails(
        "insert into public.places (provider, provider_place_id, name, lat, lng) values ('osm', 'node123', 'Dup', 0, 0)",
        [],
        /places_provider_provider_place_id_key/,
      );
      await db.as(w.outsider);
      expect(await db.query("select 1 from public.places where id = $1", [id])).toHaveLength(1);
      expect(await db.query("select 1 from public.geocode_cache")).toHaveLength(2);
      // member boleh menautkan place hasil cari manual
      await db.as(w.member);
      expect(
        await db.affected("update public.activities set place_id = $2, verification_status = 'manual' where id = $1", [w.activityId, id]),
      ).toBe(1);
    }),
  );
});

describe("profiles", () => {
  it("hanya profil sendiri; is_anonymous tidak bisa diubah user", () =>
    tx(async (db) => {
      const a = await createUser(db, { name: "Andi Wijaya" });
      const b = await createUser(db, { name: "Bunga" });
      await db.as(a);
      const p = await db.one<{ display_name: string; is_anonymous: boolean }>("select display_name, is_anonymous from public.profiles");
      expect(p).toEqual({ display_name: "Andi Wijaya", is_anonymous: false });
      expect(await db.query("select 1 from public.profiles where id = $1", [b.id])).toHaveLength(0);
      expect(await db.affected("update public.profiles set display_name = 'Andi' where id = $1", [a.id])).toBe(1);
      await db.fails("update public.profiles set is_anonymous = true where id = $1", [a.id], /permission denied/);
      await db.fails("insert into public.profiles (id) values (gen_random_uuid())", [], /permission denied/);
    }),
  );

  it("trigger: user anonim → profil anonim; tautkan Google → is_anonymous false + nama", () =>
    tx(async (db) => {
      const g = await createUser(db, { anonymous: true });
      const before = await db.one("select display_name, is_anonymous from public.profiles where id = $1", [g.id]);
      expect(before).toEqual({ display_name: null, is_anonymous: true });
      await db.query(
        "update auth.users set is_anonymous = false, raw_user_meta_data = '{\"name\":\"Citra\",\"avatar_url\":\"https://x/a.png\"}' where id = $1",
        [g.id],
      );
      const after = await db.one("select display_name, avatar_url, is_anonymous from public.profiles where id = $1", [g.id]);
      expect(after).toEqual({ display_name: "Citra", avatar_url: "https://x/a.png", is_anonymous: false });
    }),
  );
});
