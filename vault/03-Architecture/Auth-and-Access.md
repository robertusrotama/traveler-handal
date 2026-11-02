---
title: Auth & Access
status: draft-review
updated: 2026-11-02
tags: [architecture, auth, security]
---

# Auth & Access

Keputusan: [[ADR-0004]] (hybrid), [[ADR-0006]] (izin AI), [[ADR-0008]] (klaim ulang & masa berlaku link).

## Identitas
| Jenis | Cara | Bisa |
|---|---|---|
| Owner | Google login (Supabase Auth) | Buat trip, semua aksi owner |
| Member berakun | Login (Google) lalu join via link | Seperti member |
| Guest | Sesi **anonim** Supabase (dibuat otomatis saat join, dengan Turnstile CAPTCHA) | Seperti member; tidak bisa membuat trip |

Guest dapat **"Amankan akunku"**: menautkan identitas Google ke user anonim (identity linking Supabase) sehingga `user_id` tetap sama dan bisa login di perangkat lain.

## Undangan
- Token: 32 byte acak (base64url) → URL `/join/<token>`. Disimpan hanya `sha256(token)`.
- Satu undangan aktif per trip. "Reset link" = set `revoked_at` undangan lama + buat baru (satu transaksi).
- `expires_at` default `end_date + 7 hari`. Bila tanggal trip diubah, undangan aktif ikut diperbarui.

## Alur join
1. `GET /join/<token>` (server) → validasi token → tampilkan preview minimal (judul, nama owner, tanggal). Token invalid/kedaluwarsa/dicabut → halaman error.
2. Tidak ada sesi → tampilkan Turnstile → `signInAnonymously` (dengan captcha token).
3. Pilihan:
   - **Join baru**: isi nama (1–40 karakter) → RPC `join_trip(token, name)` → redirect ke trip.
   - **"Saya sudah pernah join sebagai …"**: daftar nama member guest aktif (tanpa info lain) → RPC `request_member_claim(token, member_id)` → layar "Menunggu persetujuan owner" (polling/realtime pada status klaim).
4. User yang sudah menjadi member aktif → langsung redirect ke trip.

## Klaim ulang
- Owner melihat badge/daftar klaim pending di halaman trip & pengaturan member.
- Approve → `decide_member_claim`: `trip_members.user_id` dipindah ke claimant; sesi lama otomatis kehilangan akses (RLS berbasis `user_id`).
- Reject → claimant tetap bukan member; bisa join sebagai member baru.
- Klaim pending kedaluwarsa setelah 7 hari.

## Pencabutan
- Owner → "Cabut" → `revoked_at = now()`. RLS memblokir semua akses berikutnya.
- Client menangani respons kosong/ditolak dengan halaman "Akses kamu ke trip ini sudah dicabut".
- Owner bisa mengaktifkan kembali member yang dicabut (hapus `revoked_at`) — opsional P1.
- Owner tidak bisa mencabut dirinya sendiri; transfer kepemilikan di luar scope MVP.

## Izin AI
- Owner: selalu boleh. Member: `can_use_ai` di-toggle owner. Dicek di server pada setiap endpoint AI.

## Kebersihan
- Vercel Cron harian: hapus user anonim tanpa keanggotaan aktif yang dibuat > 30 hari lalu; kedaluwarsakan klaim pending > 7 hari.
