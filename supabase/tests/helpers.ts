/**
 * Harness test DB (RLS + RPC) — `pnpm test:db`.
 *
 * Env: TEST_DATABASE_URL = koneksi superuser ke server Postgres 15+
 *      (default postgres://postgres:postgres@localhost:5432/postgres, lihat ./config.ts).
 * global-setup.ts membuat database baru per run, menerapkan shim.sql (emulasi auth/role Supabase)
 * + migrations + seed, lalu menghapusnya setelah selesai.
 *
 * Setiap test berjalan di dalam `tx()` yang selalu di-ROLLBACK. `db.as(user)` meniru request
 * PostgREST: `set local role authenticated` + `request.jwt.claims` (sub, is_anonymous).
 */
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, expect, inject } from "vitest";

pg.types.setTypeParser(1082, (v) => v); // date → 'YYYY-MM-DD'

const pool = new pg.Pool({ connectionString: inject("dbUrl"), max: 4 });
afterAll(() => pool.end());

export type User = { id: string; anonymous: boolean };
export type Actor = User | "anon" | "service" | "admin";

export class Db {
  constructor(private c: pg.PoolClient) {}

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.c.query(sql, params)).rows as T[];
  }

  async one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
    const rows = await this.query<T>(sql, params);
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  /** Ganti peran untuk statement berikutnya (dalam transaksi ini). */
  async as(actor: Actor): Promise<this> {
    await this.c.query("reset role");
    if (actor === "admin") {
      await this.c.query("select set_config('request.jwt.claims', '', true)");
      return this;
    }
    const role = actor === "anon" ? "anon" : actor === "service" ? "service_role" : "authenticated";
    const claims =
      typeof actor === "object"
        ? { sub: actor.id, role, is_anonymous: actor.anonymous }
        : { role };
    await this.c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await this.c.query(`set local role ${role}`);
    return this;
  }

  /** Jalankan statement yang harus gagal; transaksi tetap bisa dipakai sesudahnya. */
  async fails(sql: string, params: unknown[] = [], pattern?: RegExp): Promise<Error> {
    await this.c.query("savepoint expect_fail");
    try {
      await this.c.query(sql, params);
    } catch (e) {
      await this.c.query("rollback to savepoint expect_fail");
      if (pattern) expect((e as Error).message).toMatch(pattern);
      return e as Error;
    }
    await this.c.query("release savepoint expect_fail");
    throw new Error(`Expected failure but succeeded: ${sql}`);
  }

  /** Jumlah baris yang terpengaruh (UPDATE/DELETE yang disaring RLS → 0). */
  async affected(sql: string, params: unknown[] = []): Promise<number> {
    return (await this.c.query(sql, params)).rowCount ?? 0;
  }
}

export async function tx(fn: (db: Db) => Promise<void>): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await fn(new Db(c));
  } finally {
    await c.query("rollback");
    c.release();
  }
}

// ───────── Fixtures (semua kembali ke peran admin) ─────────

export async function createUser(db: Db, opts: { anonymous?: boolean; name?: string } = {}): Promise<User> {
  await db.as("admin");
  const anonymous = opts.anonymous ?? false;
  const meta = opts.name ? { full_name: opts.name } : {};
  const { id } = await db.one<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data, is_anonymous) values ($1, $2, $3) returning id",
    [anonymous ? null : `${randomBytes(4).toString("hex")}@example.com`, meta, anonymous],
  );
  return { id, anonymous };
}

export const TRIP_ARGS = {
  title: "Liburan Jepang",
  country: "JP",
  cities: ["Tokyo", "Kyoto"],
  start: "2027-03-01",
  end: "2027-03-03",
};

export const CREATE_TRIP_SQL =
  "select public.create_trip($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9::trip_pace, $10::budget_level) as id";

export async function createTrip(db: Db, owner: User, o: Partial<typeof TRIP_ARGS> = {}): Promise<string> {
  const a = { ...TRIP_ARGS, ...o };
  await db.as(owner);
  const { id } = await db.one<{ id: string }>(CREATE_TRIP_SQL, [
    a.title, a.country, a.cities, a.start, a.end, 2, ["kuliner"], null, "sedang", "hemat",
  ]);
  await db.as("admin");
  return id;
}

export const hashToken = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

/** Buat/reset link undangan seperti server Next.js: token acak base64url, kirim hash-nya. */
export async function rotateInvite(db: Db, owner: User, tripId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.as(owner);
  await db.query("select public.rotate_trip_invite($1, $2)", [tripId, hashToken(token)]);
  await db.as("admin");
  return token;
}

export async function joinTrip(db: Db, user: User, token: string, name: string): Promise<string> {
  await db.as(user);
  const { id } = await db.one<{ id: string }>("select public.join_trip($1, $2) as id", [token, name]);
  await db.as("admin");
  return id;
}

export async function addActivity(db: Db, tripId: string, dayId: string | null, title: string, position = 1024) {
  await db.as("admin");
  const { id } = await db.one<{ id: string }>(
    "insert into public.activities (trip_id, day_id, position, title, category) values ($1, $2, $3, $4, 'kuliner') returning id",
    [tripId, dayId, position, title],
  );
  return id;
}

/**
 * Satu trip dengan semua peran: owner, member berakun, guest anonim (member), member dicabut,
 * orang luar (berakun) + 1 aktivitas di hari pertama.
 */
export async function world(db: Db) {
  const owner = await createUser(db, { name: "Owner Satu" });
  const member = await createUser(db, { name: "Member Dua" });
  const guest = await createUser(db, { anonymous: true });
  const revoked = await createUser(db, { name: "Dicabut" });
  const outsider = await createUser(db, { name: "Orang Luar" });
  const tripId = await createTrip(db, owner);
  const token = await rotateInvite(db, owner, tripId);
  await joinTrip(db, member, token, "Budi");
  await joinTrip(db, guest, token, "Tamu");
  await joinTrip(db, revoked, token, "Cabut");
  await db.query("update public.trip_members set revoked_at = now() where trip_id = $1 and user_id = $2", [
    tripId,
    revoked.id,
  ]);
  const days = await db.query<{ id: string; day_index: number; date: string }>(
    "select id, day_index, date from public.days where trip_id = $1 order by day_index",
    [tripId],
  );
  const activityId = await addActivity(db, tripId, days[0].id, "Sushi");
  const memberRow = async (uid: string) =>
    (await db.as("admin")).one<{ id: string }>("select id from public.trip_members where trip_id = $1 and user_id = $2", [tripId, uid]);
  return { owner, member, guest, revoked, outsider, tripId, token, days, activityId, memberRow };
}
