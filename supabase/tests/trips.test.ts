import { describe, expect, it } from "vitest";
import { addActivity, CREATE_TRIP_SQL, createTrip, createUser, tx, world, type Db } from "./helpers";

const args = (o: Record<number, unknown> = {}) => {
  const a: unknown[] = [" Liburan ", "jp", [" Tokyo ", "", "Kyoto"], "2027-03-01", "2027-03-03", 2, ["kuliner", " "], "  ", "padat", "mewah"];
  for (const [i, v] of Object.entries(o)) a[Number(i)] = v;
  return a;
};

const dayRows = (db: Db, tripId: string) =>
  db.query<{ id: string; day_index: number; date: string; title: string | null }>(
    "select id, day_index, date, title from public.days where trip_id = $1 order by day_index",
    [tripId],
  );

describe("create_trip", () => {
  it("membuat trip + days + member owner dalam satu panggilan, input dinormalisasi", () =>
    tx(async (db) => {
      const owner = await createUser(db, { name: "Rina Putri" });
      await db.as(owner);
      const { id } = await db.one<{ id: string }>(CREATE_TRIP_SQL, args());
      const trip = await db.one("select title, country_code, cities, interests, interests_note, pace, budget_level, status from public.trips where id = $1", [id]);
      expect(trip).toEqual({
        title: "Liburan",
        country_code: "JP",
        cities: ["Tokyo", "Kyoto"],
        interests: ["kuliner"],
        interests_note: null,
        pace: "padat",
        budget_level: "mewah",
        status: "active",
      });
      expect((await dayRows(db, id)).map((d) => d.date)).toEqual(["2027-03-01", "2027-03-02", "2027-03-03"]);
      const m = await db.one("select display_name, role, can_use_ai, revoked_at from public.trip_members where trip_id = $1", [id]);
      expect(m).toEqual({ display_name: "Rina Putri", role: "owner", can_use_ai: true, revoked_at: null });
    }),
  );

  it("judul kosong → 'Trip ke {kota pertama}'; argumen opsional punya default", () =>
    tx(async (db) => {
      const owner = await createUser(db);
      await db.as(owner);
      const { id } = await db.one<{ id: string }>(
        "select public.create_trip(p_title => '', p_country_code => 'ID', p_cities => '{Bali}', p_start_date => '2027-01-01', p_end_date => '2027-01-01', p_travelers_count => 1, p_interests => '{}') as id",
      );
      const t = await db.one("select title, pace, budget_level from public.trips where id = $1", [id]);
      expect(t).toEqual({ title: "Trip ke Bali", pace: "sedang", budget_level: "sedang" });
      const m = await db.one("select display_name from public.trip_members where trip_id = $1", [id]);
      expect(m.display_name).toBe("Owner"); // profil tanpa nama
    }),
  );

  it("user anonim ditolak (klaim JWT maupun profil)", () =>
    tx(async (db) => {
      const guest = await createUser(db, { anonymous: true });
      await db.as(guest);
      await db.fails(CREATE_TRIP_SQL, args(), /anonymous_not_allowed/);
      // JWT bilang bukan anonim tapi profil anonim → tetap ditolak
      await db.as({ id: guest.id, anonymous: false });
      await db.fails(CREATE_TRIP_SQL, args(), /anonymous_not_allowed/);
      await db.as("anon");
      await db.fails(CREATE_TRIP_SQL, args(), /permission denied for function create_trip/);
    }),
  );

  it.each([
    ["end < start", { 4: "2027-02-28" }, /invalid_dates/],
    ["durasi 22 hari", { 4: "2027-03-22" }, /invalid_dates/],
    ["tanggal null", { 3: null }, /invalid_dates/],
    ["tanpa kota", { 2: [" ", ""] }, /invalid_cities/],
    ["kota null", { 2: null }, /invalid_cities/],
    ["negara invalid", { 1: "JPN" }, /invalid_country_code/],
    ["travelers 0", { 5: 0 }, /invalid_travelers_count/],
    ["judul > 100", { 0: "a".repeat(101) }, /invalid_title/],
    ["catatan minat > 500", { 7: "a".repeat(501) }, /invalid_interests_note/],
  ])("validasi: %s", (_, o, err) =>
    tx(async (db) => {
      const owner = await createUser(db);
      await db.as(owner);
      await db.fails(CREATE_TRIP_SQL, args(o), err);
      await db.as("admin");
      expect(await db.query("select 1 from public.trips")).toHaveLength(0);
    }),
  );

  it("durasi 21 hari diterima", () =>
    tx(async (db) => {
      const owner = await createUser(db);
      const id = await createTrip(db, owner, { start: "2027-03-01", end: "2027-03-21" });
      expect(await dayRows(db, id)).toHaveLength(21);
    }),
  );
});

describe("update_trip_dates", () => {
  const call = "select public.update_trip_dates($1, $2::date, $3::date)";

  it("memperpanjang menambah hari kosong di akhir, isi lama tetap", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.query("update public.days set title = 'Hari 1' where id = $1", [w.days[0].id]);
      await db.as(w.owner);
      await db.query(call, [w.tripId, "2027-03-01", "2027-03-05"]);
      const days = await dayRows(db, w.tripId);
      expect(days.map((d) => [d.day_index, d.date])).toEqual([
        [0, "2027-03-01"], [1, "2027-03-02"], [2, "2027-03-03"], [3, "2027-03-04"], [4, "2027-03-05"],
      ]);
      expect(days[0]).toMatchObject({ id: w.days[0].id, title: "Hari 1" });
      const t = await db.one("select start_date, end_date from public.trips where id = $1", [w.tripId]);
      expect(t).toEqual({ start_date: "2027-03-01", end_date: "2027-03-05" });
    }),
  );

  it("memperpendek memindah aktivitas hari terhapus ke pool setelah isi pool (tidak ada yang hilang)", () =>
    tx(async (db) => {
      const w = await world(db);
      const [d0, d1, d2] = w.days.map((d) => d.id);
      await addActivity(db, w.tripId, null, "Pool lama", 5000);
      const b = await addActivity(db, w.tripId, d1, "B", 2048);
      const a = await addActivity(db, w.tripId, d1, "A", 1024);
      const c = await addActivity(db, w.tripId, d2, "C", 10);
      await db.as(w.owner);
      await db.query(call, [w.tripId, "2027-03-01", "2027-03-01"]);
      await db.as("admin");
      expect((await dayRows(db, w.tripId)).map((d) => d.id)).toEqual([d0]);
      const acts = await db.query<{ id: string; title: string; day_id: string | null; position: number }>(
        "select id, title, day_id, position from public.activities where trip_id = $1 order by day_id nulls last, position",
        [w.tripId],
      );
      expect(acts).toHaveLength(5);
      expect(acts.map((x) => [x.title, x.day_id])).toEqual([
        ["Sushi", d0],
        ["Pool lama", null],
        ["A", null],
        ["B", null],
        ["C", null],
      ]);
      expect(acts.filter((x) => [a, b, c].includes(x.id)).map((x) => x.position)).toEqual([5000 + 1024, 5000 + 2048, 5000 + 3072]);
    }),
  );

  it("menggeser tanggal mulai menggeser semua hari tanpa mengubah isi; undangan aktif ikut diperbarui", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.owner);
      await db.query(call, [w.tripId, "2027-04-10", "2027-04-12"]);
      const days = await dayRows(db, w.tripId);
      expect(days.map((d) => d.id)).toEqual(w.days.map((d) => d.id));
      expect(days.map((d) => d.date)).toEqual(["2027-04-10", "2027-04-11", "2027-04-12"]);
      const act = await db.one("select day_id from public.activities where id = $1", [w.activityId]);
      expect(act.day_id).toBe(w.days[0].id);
      const inv = await db.one<{ expires_at: Date }>("select expires_at from public.trip_invites where trip_id = $1 and revoked_at is null", [w.tripId]);
      expect(inv.expires_at.toISOString()).toBe("2027-04-20T00:00:00.000Z"); // akhir hari end_date + 7 (UTC)
    }),
  );

  it("geser + perpendek sekaligus", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.owner);
      await db.query(call, [w.tripId, "2027-02-27", "2027-02-28"]);
      expect((await dayRows(db, w.tripId)).map((d) => [d.id, d.date])).toEqual([
        [w.days[0].id, "2027-02-27"],
        [w.days[1].id, "2027-02-28"],
      ]);
    }),
  );

  it("hanya owner; tanggal divalidasi", () =>
    tx(async (db) => {
      const w = await world(db);
      for (const u of [w.member, w.guest, w.outsider]) {
        await db.as(u);
        await db.fails(call, [w.tripId, "2027-03-01", "2027-03-02"], /forbidden/);
      }
      await db.as(w.owner);
      await db.fails(call, [w.tripId, "2027-03-05", "2027-03-01"], /invalid_dates/);
      await db.fails(call, [w.tripId, "2027-03-01", "2027-03-30"], /invalid_dates/);
    }),
  );
});

describe("rebalance_positions", () => {
  it("menata ulang posisi hari/pool dengan jarak 1024; hanya member", () =>
    tx(async (db) => {
      const w = await world(db);
      const d = w.days[1].id;
      await addActivity(db, w.tripId, d, "X", 1.0000001);
      await addActivity(db, w.tripId, d, "Y", 1.0000002);
      await addActivity(db, w.tripId, null, "P", 0.5);
      await db.as(w.guest);
      await db.query("select public.rebalance_positions($1, $2)", [w.tripId, d]);
      await db.query("select public.rebalance_positions($1)", [w.tripId]); // pool
      await db.as("admin");
      const rows = await db.query<{ title: string; position: number }>(
        "select title, position from public.activities where trip_id = $1 and (day_id = $2 or day_id is null) order by day_id nulls last, position",
        [w.tripId, d],
      );
      expect(rows).toEqual([
        { title: "X", position: 1024 },
        { title: "Y", position: 2048 },
        { title: "P", position: 1024 },
      ]);
      await db.as(w.outsider);
      await db.fails("select public.rebalance_positions($1, $2)", [w.tripId, d], /forbidden/);
      const other = await createTrip(db, w.member, { title: "Lain" });
      const otherDay = (await db.one<{ id: string }>("select id from public.days where trip_id = $1 limit 1", [other])).id;
      await db.as(w.member);
      await db.fails("select public.rebalance_positions($1, $2)", [w.tripId, otherDay], /day_not_found/);
    }),
  );
});
