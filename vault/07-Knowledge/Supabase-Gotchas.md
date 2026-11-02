---
title: Supabase Gotchas
status: active
updated: 2026-11-02
tags: [knowledge, supabase, rls]
---

# Supabase Gotchas (dari implementasi W1-DB)

Terkait: [[Data-Model]], [[Security]], [[Testing-Strategy]].

1. **Default grant Supabase.** `anon`/`authenticated` otomatis mendapat EXECUTE fungsi & hak tabel. Migration `init` me-revoke secara eksplisit; **setiap tabel/fungsi baru di migration berikutnya mendapat default grant lagi** → wajib revoke ulang. — *High confidence* (diuji: test gagal saat revoke dihapus).
2. **Column-level grant.** Kolom yang tidak boleh di-update member (`trips` tanggal & `owner_id`, `activities.trip_id`, `days.date/day_index`, `trip_members` selain `revoked_at`/`can_use_ai`) tidak di-grant UPDATE. Payload `update/upsert` yang menyertakan kolom itu ditolak "permission denied" → **kirim hanya field yang berubah.** Perubahan tanggal trip lewat RPC `update_trip_dates`. — *High confidence* (test).
3. **Composite FK** `(trip_id, day_id)` dengan `ON DELETE SET NULL (day_id)` menjamin aktivitas & hari satu trip; sintaks butuh Postgres ≥ 15. — *High confidence*.
4. **Rate limiter** `take_rate_limit_slot` memakai `clock_timestamp()` setelah row lock; `now()` beku sejak awal transaksi. — *High confidence*.
5. **Realtime DELETE** tidak bisa difilter dan hanya membawa primary key saat RLS aktif → client refetch setelah event DELETE. — *Medium confidence* (dokumentasi Supabase Realtime; belum diuji end-to-end).
6. **"Amankan akunku"** (`linkIdentity`) butuh *manual linking* aktif (`enable_manual_linking`; di produksi: setting dashboard Auth). — *Medium confidence*.
7. **Error RPC**: `message` = kode stabil (`invalid_dates`, `invite_invalid`, `access_revoked`, `forbidden`, `claim_expired`, `claimant_already_member`, …), `hint` = teks Indonesia untuk UI.
8. **Fungsi internal** di schema `private` (tidak diekspos PostgREST).
9. **Test RLS tanpa Docker:** Postgres 16 lokal + `supabase/tests/shim.sql` (role `anon/authenticated/service_role`, `auth.uid()/auth.jwt()` dari `request.jwt.claims`). Shim ≠ Supabase asli → sebelum produksi jalankan juga di `supabase start` / project staging. — *Medium confidence* bahwa shim cukup setia.
