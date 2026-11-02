import { describe, expect, it } from "vitest";
import { createTrip, createUser, hashToken, joinTrip, rotateInvite, tx, world, type Db, type User } from "./helpers";

const JOIN = "select public.join_trip($1, $2) as id";

async function claim(db: Db, user: User, token: string, memberId: string): Promise<string> {
  await db.as(user);
  const { id } = await db.one<{ id: string }>("select public.request_member_claim($1, $2) as id", [token, memberId]);
  return id;
}

describe("rotate_trip_invite", () => {
  it("satu undangan aktif per trip; reset mencabut yang lama seketika", () =>
    tx(async (db) => {
      const owner = await createUser(db, { name: "O" });
      const tripId = await createTrip(db, owner);
      const t1 = await rotateInvite(db, owner, tripId);
      const t2 = await rotateInvite(db, owner, tripId);
      const rows = await db.query<{ token_hash: string; revoked_at: Date | null; expires_at: Date }>(
        "select token_hash, revoked_at, expires_at from public.trip_invites where trip_id = $1 order by created_at, revoked_at nulls last",
        [tripId],
      );
      expect(rows.filter((r) => r.revoked_at === null).map((r) => r.token_hash)).toEqual([hashToken(t2)]);
      expect(rows).toHaveLength(2);
      expect(rows[0].expires_at.toISOString()).toBe("2027-03-11T00:00:00.000Z"); // end 03-03 + 7 hari, akhir hari
      // index parsial menolak dua undangan aktif
      await db.fails(
        "insert into public.trip_invites (trip_id, token_hash, created_by, expires_at) values ($1, repeat('b', 64), $2, now() + interval '1 day')",
        [tripId, owner.id],
        /trip_invites_one_active_key/,
      );
      const other = await createUser(db);
      await db.as(other);
      await db.fails("select public.join_trip($1, 'X')", [t1], /invite_invalid/);
      expect((await db.one<{ id: string }>(JOIN, [t2, "X"])).id).toBe(tripId);
    }),
  );

  it("hanya owner; hash divalidasi", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.member);
      await db.fails("select public.rotate_trip_invite($1, $2)", [w.tripId, hashToken("x")], /forbidden/);
      await db.as(w.owner);
      await db.fails("select public.rotate_trip_invite($1, 'bukan-hash')", [w.tripId], /invalid_token_hash/);
    }),
  );
});

describe("get_invite_preview", () => {
  it("anon bisa melihat preview minimal; kosong bila invalid/kedaluwarsa/dicabut", () =>
    tx(async (db) => {
      const w = await world(db);
      const preview = "select * from public.get_invite_preview($1)";
      await db.as("anon");
      expect(await db.query(preview, [w.token])).toEqual([
        { trip_id: w.tripId, title: "Liburan Jepang", owner_name: "Owner Satu", start_date: "2027-03-01", end_date: "2027-03-03" },
      ]);
      expect(await db.query(preview, ["salah"])).toEqual([]);
      expect(await db.query(preview, [null])).toEqual([]);
      await db.as("admin");
      await db.query("update public.trip_invites set expires_at = now() - interval '1 second' where trip_id = $1", [w.tripId]);
      await db.as("anon");
      expect(await db.query(preview, [w.token])).toEqual([]);
      await db.as("admin");
      await db.query("update public.trip_invites set expires_at = now() + interval '1 day', revoked_at = now() where trip_id = $1", [w.tripId]);
      await db.as("anon");
      expect(await db.query(preview, [w.token])).toEqual([]);
      // fungsi lain tidak untuk anon
      await db.fails("select * from public.list_claimable_members($1)", [w.token], /permission denied/);
      await db.fails(JOIN, [w.token, "X"], /permission denied/);
    }),
  );
});

describe("join_trip", () => {
  it("token valid: membuat member (tanpa izin AI); idempoten untuk member aktif", () =>
    tx(async (db) => {
      const w = await world(db);
      const u = await createUser(db, { anonymous: true });
      await db.as(u);
      expect((await db.one<{ id: string }>(JOIN, [w.token, "  Sari  "])).id).toBe(w.tripId);
      expect((await db.one<{ id: string }>(JOIN, [w.token, "Nama Lain"])).id).toBe(w.tripId);
      await db.as("admin");
      const rows = await db.query("select display_name, role, can_use_ai from public.trip_members where trip_id = $1 and user_id = $2", [w.tripId, u.id]);
      expect(rows).toEqual([{ display_name: "Sari", role: "member", can_use_ai: false }]);
      // owner membuka link sendiri → langsung trip-nya
      await db.as(w.owner);
      expect((await db.one<{ id: string }>(JOIN, [w.token, "apa saja"])).id).toBe(w.tripId);
    }),
  );

  it("member aktif tetap diarahkan walau link sudah direset", () =>
    tx(async (db) => {
      const w = await world(db);
      await rotateInvite(db, w.owner, w.tripId);
      await db.as(w.member);
      expect((await db.one<{ id: string }>(JOIN, [w.token, "Budi"])).id).toBe(w.tripId);
    }),
  );

  it("token invalid / kedaluwarsa / dicabut ditolak", () =>
    tx(async (db) => {
      const w = await world(db);
      const u = await createUser(db);
      await db.as(u);
      await db.fails(JOIN, ["token-ngawur", "X"], /invite_invalid/);
      await db.fails(JOIN, [null, "X"], /invite_invalid/);
      await db.as("admin");
      await db.query("update public.trip_invites set expires_at = now() - interval '1 minute' where trip_id = $1", [w.tripId]);
      await db.as(u);
      await db.fails(JOIN, [w.token, "X"], /invite_invalid/);
      await db.as("admin");
      await db.query("update public.trip_invites set expires_at = now() + interval '1 day', revoked_at = now() where trip_id = $1", [w.tripId]);
      await db.as(u);
      await db.fails(JOIN, [w.token, "X"], /invite_invalid/);
      await db.as("admin");
      expect(await db.query("select 1 from public.trip_members where user_id = $1", [u.id])).toHaveLength(0);
    }),
  );

  it("member yang dicabut tidak bisa join ulang diam-diam", () =>
    tx(async (db) => {
      const w = await world(db);
      await db.as(w.revoked);
      await db.fails(JOIN, [w.token, "Cabut lagi"], /access_revoked/);
    }),
  );

  it.each([[""], ["   "], ["a".repeat(41)], [null]])("nama tidak valid: %j", (name) =>
    tx(async (db) => {
      const w = await world(db);
      const u = await createUser(db);
      await db.as(u);
      await db.fails(JOIN, [w.token, name], /invalid_display_name/);
    }),
  );

  it("nama 40 karakter diterima; tanpa sesi ditolak", () =>
    tx(async (db) => {
      const w = await world(db);
      const u = await createUser(db);
      await joinTrip(db, u, w.token, "a".repeat(40));
      await db.as({ id: "", anonymous: true } as User);
      await db.fails(JOIN, [w.token, "X"], /not_authenticated/);
    }),
  );
});

describe("klaim ulang identitas", () => {
  it("list_claimable_members: hanya guest anonim aktif non-owner, tanpa diri sendiri", () =>
    tx(async (db) => {
      const w = await world(db);
      const newDevice = await createUser(db, { anonymous: true });
      const { id: guestRow } = await w.memberRow(w.guest.id);
      await db.as(newDevice);
      expect(await db.query("select * from public.list_claimable_members($1)", [w.token])).toEqual([
        { member_id: guestRow, display_name: "Tamu" },
      ]);
      await db.as(w.guest);
      expect(await db.query("select * from public.list_claimable_members($1)", [w.token])).toEqual([]);
      await db.as(newDevice);
      expect(await db.query("select * from public.list_claimable_members('salah')")).toEqual([]);
    }),
  );

  it("approve: user_id pindah ke claimant, sesi lama kehilangan akses", () =>
    tx(async (db) => {
      const w = await world(db);
      const { id: guestRow } = await w.memberRow(w.guest.id);
      const newDevice = await createUser(db, { anonymous: true });
      const claimId = await claim(db, newDevice, w.token, guestRow);
      // idempoten selama masih pending
      expect(await claim(db, newDevice, w.token, guestRow)).toBe(claimId);
      expect((await db.one("select public.my_claim_status($1) as s", [claimId])).s).toBe("pending");
      expect(await db.query("select 1 from public.trips where id = $1", [w.tripId])).toHaveLength(0);

      // owner melihat klaim pending; member lain tidak
      await db.as(w.member);
      expect(await db.query("select 1 from public.member_claims where id = $1", [claimId])).toHaveLength(0);
      await db.fails("select public.decide_member_claim($1, true)", [claimId], /forbidden/);
      await db.as(newDevice);
      await db.fails("select public.decide_member_claim($1, true)", [claimId], /forbidden/);
      await db.fails("update public.member_claims set status = 'approved' where id = $1", [claimId], /permission denied/);

      await db.as(w.owner);
      expect(await db.query("select 1 from public.member_claims where id = $1 and status = 'pending'", [claimId])).toHaveLength(1);
      await db.query("select public.decide_member_claim($1, true)", [claimId]);
      await db.fails("select public.decide_member_claim($1, false)", [claimId], /claim_already_decided/);

      await db.as(newDevice);
      expect((await db.one("select public.my_claim_status($1) as s", [claimId])).s).toBe("approved");
      expect(await db.query("select 1 from public.trips where id = $1", [w.tripId])).toHaveLength(1);
      const row = await db.one("select id, display_name from public.trip_members where trip_id = $1 and user_id = $2", [w.tripId, newDevice.id]);
      expect(row).toEqual({ id: guestRow, display_name: "Tamu" });

      await db.as(w.guest);
      expect(await db.query("select 1 from public.trips where id = $1", [w.tripId])).toHaveLength(0);
      expect(await db.query("select 1 from public.activities where trip_id = $1", [w.tripId])).toHaveLength(0);
      expect(await db.query("select 1 from public.trip_members where trip_id = $1", [w.tripId])).toHaveLength(0);
    }),
  );

  it("reject: claimant tetap bukan member, bisa join baru", () =>
    tx(async (db) => {
      const w = await world(db);
      const { id: guestRow } = await w.memberRow(w.guest.id);
      const newDevice = await createUser(db, { anonymous: true });
      const claimId = await claim(db, newDevice, w.token, guestRow);
      await db.as(w.owner);
      await db.query("select public.decide_member_claim($1, false)", [claimId]);
      await db.as(newDevice);
      expect((await db.one("select public.my_claim_status($1) as s", [claimId])).s).toBe("rejected");
      expect(await db.query("select 1 from public.trips where id = $1", [w.tripId])).toHaveLength(0);
      expect((await db.one<{ id: string }>(JOIN, [w.token, "Tamu 2"])).id).toBe(w.tripId);
      await db.as(w.guest);
      expect(await db.query("select 1 from public.trips where id = $1", [w.tripId])).toHaveLength(1);
    }),
  );

  it("klaim > 7 hari kedaluwarsa: tidak bisa diputuskan, status dilaporkan rejected, bisa diajukan ulang", () =>
    tx(async (db) => {
      const w = await world(db);
      const { id: guestRow } = await w.memberRow(w.guest.id);
      const newDevice = await createUser(db, { anonymous: true });
      const claimId = await claim(db, newDevice, w.token, guestRow);
      await db.as("admin");
      await db.query("update public.member_claims set created_at = now() - interval '8 days' where id = $1", [claimId]);
      await db.as(w.owner);
      await db.fails("select public.decide_member_claim($1, true)", [claimId], /claim_expired/);
      await db.as(newDevice);
      expect((await db.one("select public.my_claim_status($1) as s", [claimId])).s).toBe("rejected");
      const again = await claim(db, newDevice, w.token, guestRow);
      expect(again).not.toBe(claimId);
    }),
  );

  it("approve ditolak bila claimant sudah punya baris member aktif", () =>
    tx(async (db) => {
      const w = await world(db);
      const { id: guestRow } = await w.memberRow(w.guest.id);
      const newDevice = await createUser(db, { anonymous: true });
      const claimId = await claim(db, newDevice, w.token, guestRow);
      await joinTrip(db, newDevice, w.token, "Dobel");
      await db.as(w.owner);
      await db.fails("select public.decide_member_claim($1, true)", [claimId], /claimant_already_member/);
    }),
  );

  it("validasi request: bukan guest / owner / dicabut / sudah member / token invalid", () =>
    tx(async (db) => {
      const w = await world(db);
      const newDevice = await createUser(db, { anonymous: true });
      const req = "select public.request_member_claim($1, $2)";
      for (const uid of [w.member.id, w.owner.id, w.revoked.id]) {
        const { id } = await w.memberRow(uid);
        await db.as(newDevice);
        await db.fails(req, [w.token, id], /member_not_claimable/);
      }
      const { id: guestRow } = await w.memberRow(w.guest.id);
      await db.as(newDevice);
      await db.fails(req, ["salah", guestRow], /invite_invalid/);
      await db.as(w.member);
      await db.fails(req, [w.token, guestRow], /already_member/);
      await db.as(w.revoked);
      await db.fails(req, [w.token, guestRow], /access_revoked/);
      // member trip lain tidak bisa diklaim lewat token trip ini
      const t2 = await createTrip(db, w.owner, { title: "Dua" });
      const tok2 = await rotateInvite(db, w.owner, t2);
      const g2 = await createUser(db, { anonymous: true });
      await joinTrip(db, g2, tok2, "Guest2");
      const { id: g2row } = await db.one<{ id: string }>("select id from public.trip_members where user_id = $1", [g2.id]);
      await db.as(newDevice);
      await db.fails(req, [w.token, g2row], /member_not_claimable/);
    }),
  );

  it("my_claim_status: null untuk orang lain", () =>
    tx(async (db) => {
      const w = await world(db);
      const { id: guestRow } = await w.memberRow(w.guest.id);
      const newDevice = await createUser(db, { anonymous: true });
      const claimId = await claim(db, newDevice, w.token, guestRow);
      await db.as(w.outsider);
      expect((await db.one("select public.my_claim_status($1) as s", [claimId])).s).toBeNull();
      await db.as(w.owner);
      expect((await db.one("select public.my_claim_status($1) as s", [claimId])).s).toBe("pending");
    }),
  );
});
