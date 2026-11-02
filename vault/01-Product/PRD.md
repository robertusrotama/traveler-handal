---
title: PRD — Traveler Handal (MVP)
status: draft-review
version: 0.1
updated: 2026-11-02
owner: robertusrotama
tags: [prd, product, mvp]
---

# PRD — Traveler Handal (MVP)

> Sumber kebenaran scope produk. Detail teknis ada di catatan arsitektur yang ditautkan. Perubahan scope → ADR baru.

## 1. Ringkasan

Traveler Handal adalah web app (PWA) pribadi untuk **merencanakan perjalanan dari nol**. Pengguna memasukkan tujuan, tanggal, dan minat; AI menyusun **draft itinerary per hari** beserta **pool ide tempat**, setiap tempat **diverifikasi ke data peta**, lalu itinerary bisa diedit dan **dibagikan ke teman** lewat link undangan untuk dilihat & diedit bersama secara realtime. Split bill direncanakan di fase 2.

## 2. Latar belakang & masalah

Masalah yang dinyatakan user (sesi brainstorming 2026-11-02):

1. **Tidak tahu harus mulai dari mana.** Saat akan ke negara/kota baru, tidak tahu tempat apa yang layak dikunjungi dan bagaimana menyusunnya per hari.
2. **Perjalanan solo dan grup.** Itinerary harus bisa diakses semua anggota trip.
3. **Budget & split bill.** Ingin mencatat pengeluaran dan langsung menghitung siapa bayar ke siapa. → *fase 2*

Alternatif yang ada (Wanderlog, TripIt, Google Sheets, Splitwise) tidak dipakai karena alasan personal; produk ini harus lebih baik **untuk alur user sendiri**, bukan untuk pasar. Risiko utama proyek: **scope creep dan mangkrak** — PRD ini sengaja ketat.

## 3. Tujuan & non-tujuan

### Tujuan MVP
- G1. Dari nol ke draft itinerary yang masuk akal untuk trip 7 hari dalam **≤ 15 menit** (termasuk review).
- G2. Setiap tempat di itinerary punya status verifikasi yang jujur (ada di peta / belum terverifikasi).
- G3. Teman bisa bergabung ke trip dalam **≤ 1 menit** tanpa membuat password.
- G4. Biaya operasional **Rp 0** (free tier) untuk skala pribadi.

### Non-tujuan (MVP)
- Bukan produk publik/komersial; tidak ada onboarding marketing, billing, atau multi-tenant skala besar.
- Bukan mesin booking (tiket, hotel).
- Bukan pengganti Google Maps untuk navigasi.

## 4. Pengguna

| Persona | Deskripsi | Kebutuhan utama |
|---|---|---|
| **Owner** (user utama) | Membuat trip, memicu AI, mengatur member & izin | Draft cepat, kontrol penuh, kontrol biaya/kuota |
| **Member** | Teman yang diundang via link; bisa guest anonim atau punya akun | Lihat & edit itinerary dari HP tanpa ribet; (opsional) boleh pakai AI bila diizinkan owner |

## 5. Metrik keberhasilan (personal)

- M1. App dipakai untuk merencanakan **trip nyata berikutnya** dari awal sampai selesai.
- M2. ≥ 80% aktivitas hasil AI berstatus *verified* setelah verifikasi (diukur dari data `activities`).
- M3. Tidak ada itinerary yang "pindah" ke Notes/Sheets/WA selama trip tersebut.
- M4. Biaya bulanan tetap $0.

## 6. Scope MVP — fitur & acceptance criteria

Prioritas: **P0** = wajib untuk rilis MVP, **P1** = masuk MVP bila waktu cukup.

### F1. Login owner — P0
- *Sebagai owner, saya login dengan Google agar trip saya tersimpan di akun saya.*
- AC:
  - Login Google via Supabase Auth; logout tersedia.
  - Hanya user non-anonim yang bisa membuat trip.
  - Tidak ada login email/password.

### F2. Buat trip — P0
- *Sebagai owner, saya membuat trip dengan tujuan dan preferensi agar AI punya konteks.*
- Input: judul (opsional, default "Trip ke {kota}"), negara, kota (1..n), tanggal mulai & selesai, jumlah orang, minat (multi-pilih: kuliner, alam, sejarah & budaya, belanja, seni & museum, hiburan malam, santai/spa, aktivitas outdoor; plus teks bebas), tempo (santai / sedang / padat), level budget (hemat / sedang / mewah).
- AC:
  - Validasi: tanggal selesai ≥ tanggal mulai; durasi 1–21 hari; minimal 1 kota.
  - Trip baru otomatis membuat baris `days` sesuai rentang tanggal dan baris `trip_members` untuk owner (role `owner`, `can_use_ai = true`).
  - Trip bisa dibuat **tanpa** generate AI (itinerary kosong, diisi manual).
  - Owner bisa mengubah info trip termasuk tanggal: memperpanjang menambah hari kosong di akhir; memperpendek meminta konfirmasi dan memindahkan aktivitas dari hari yang terhapus ke pool ide (tidak ada aktivitas yang hilang). Mengubah tanggal mulai menggeser tanggal semua hari tanpa mengubah isinya.

### F3. AI generate itinerary — P0
- *Sebagai owner/member berizin, saya meminta AI menyusun draft itinerary per hari.*
- Alur: Tahap 1 *outline* (tema & kota per hari) → Tahap 2 *detail per hari* (aktivitas) → verifikasi tempat. Detail di [[AI-Planner]].
- AC:
  - Setiap hari berisi 3–5 aktivitas (tempo santai 3, sedang 4, padat 5 sebagai target, bukan aturan keras) dengan: judul, kategori, jam mulai saran, estimasi durasi, alasan singkat ("kenapa ke sini"), `search_query`.
  - Output AI dalam **Bahasa Indonesia**; nama tempat dalam nama aslinya/umum.
  - Progres ditampilkan per tahap dan per hari.
  - Kegagalan satu hari **tidak** menghapus hari lain; hari gagal punya tombol "Coba lagi".
  - Generate ulang seluruh trip meminta konfirmasi bila sudah ada aktivitas (menimpa aktivitas `source = ai` yang belum pernah diedit manusia; aktivitas manual atau yang sudah diedit dipertahankan). *Lihat Open Question OQ-5.*
  - Data yang dikirim ke AI hanya: tujuan, tanggal/durasi, minat, tempo, budget, (untuk regenerate) daftar nama tempat yang sudah ada & instruksi bebas user. Tidak ada nama/email member.
  - Ditolak dengan pesan jelas bila kuota harian trip habis atau user tidak punya izin AI.

### F4. Verifikasi tempat — P0
- *Sebagai pengguna, saya ingin tahu tempat mana yang benar-benar ada di peta.*
- AC:
  - Setiap aktivitas dari AI/import di-geocode via `PlaceVerifier` (MVP: OSM Nominatim) memakai `search_query` + kota + negara.
  - Cocok & jarak ≤ 50 km dari kota hari tersebut → `verified`, simpan ke `places` (koordinat, alamat, kategori, jam buka bila ada).
  - Tidak cocok / terlalu jauh → `unverified` + badge yang terlihat; pengguna bisa memilih tempat secara manual (F6) → `manual`.
  - Kecepatan request ke Nominatim ≤ 1/detik secara global untuk seluruh app; hasil di-cache di `geocode_cache`.
  - Atribusi "© OpenStreetMap contributors" tampil di mana data/peta OSM ditampilkan.

### F5. Pool ide tempat — P0
- *Sebagai pengguna yang tidak tahu harus ke mana, saya melihat daftar ide tempat cadangan dan memasukkannya ke hari tertentu.*
- AC:
  - AI menghasilkan 8–15 ide tempat di luar jadwal (per trip), terverifikasi seperti F4.
  - Pool tampil terpisah; item bisa dipindah (drag atau aksi "Tambah ke Hari X") ke hari mana pun, dan sebaliknya aktivitas bisa dikembalikan ke pool.

### F6. Editor itinerary — P0
- AC:
  - Tambah aktivitas manual: judul wajib; tempat opsional via pencarian **tombol "Cari"** (bukan search-as-you-type, karena kebijakan Nominatim).
  - Edit judul, jam mulai, durasi, catatan, kategori; hapus aktivitas (dengan undo singkat).
  - Urutkan ulang dalam hari dan pindah antar hari (drag & drop di desktop; aksi menu/drag di mobile).
  - Edit tema & catatan per hari.
  - Perubahan tersimpan otomatis (tanpa tombol simpan global).

### F6a. Aksi AI granular — P0
- **Regenerate satu hari** dengan instruksi opsional (mis. "lebih santai", "tambah kuliner lokal"); menghindari tempat yang sudah ada di hari lain.
- **Alternatif untuk satu aktivitas**: 3 opsi pengganti terverifikasi untuk slot yang sama; pengguna memilih satu atau batal.
- AC: tunduk pada izin & kuota yang sama dengan F3.

### F6b. Mode import manual (cadangan AI) — P0
- *Saat kuota AI habis atau provider gagal, saya tetap bisa memakai AI di luar app.*
- AC:
  - App menampilkan prompt template berisi konteks trip (tanpa data pribadi) + JSON schema yang diharapkan, dengan tombol salin.
  - Pengguna menempel JSON hasil; app memvalidasi dengan schema yang sama dengan F3, menampilkan error yang bisa dipahami bila tidak valid, lalu menjalankan verifikasi F4.
  - Import dicatat di `ai_generations` dengan `kind = import` (tidak memotong kuota).

### F7. Peta per hari — P1
- AC:
  - Peta menampilkan pin aktivitas terverifikasi untuk hari yang dipilih, bernomor sesuai urutan, dengan garis penghubung urutan.
  - Menampilkan jarak garis lurus antar aktivitas berurutan (bukan waktu tempuh).
  - Aktivitas tanpa koordinat tercantum di daftar "tidak ada di peta".

### F8. Share & join (hybrid) — P0
- Detail di [[Auth-and-Access]].
- AC:
  - Owner membuat link undangan; satu link aktif per trip; "Reset link" mematikan link lama seketika.
  - Default masa berlaku: sampai `end_date + 7 hari`; owner bisa reset kapan saja.
  - Pembuka link melihat preview minimal (judul, nama owner, tanggal) sebelum join; itinerary tidak terlihat sebelum join.
  - Join tanpa akun: sesi anonim dibuat otomatis (dengan CAPTCHA), cukup isi nama.
  - Join dengan akun yang sudah login juga didukung.
  - "Saya sudah pernah join sebagai …" membuat **permintaan klaim** yang harus disetujui owner; setelah disetujui, baris member lama diikat ke sesi baru dan sesi lama kehilangan akses.
  - Guest bisa "Amankan akunku" (menautkan sesi anonim ke Google) agar bisa login di perangkat lain.
  - Owner bisa: melihat daftar member, mencabut akses member, memberi/mencabut izin AI per member.
  - Member yang dicabut melihat halaman "Akses kamu ke trip ini sudah dicabut".

### F9. Realtime sync — P0
- AC:
  - Perubahan aktivitas/hari/member oleh satu pengguna muncul di perangkat member lain yang sedang membuka trip tanpa refresh (target < 3 detik pada koneksi normal).
  - Konflik: last-write-wins per baris ([[ADR-0007]]).

### F10. PWA & offline read-only — P1
- AC:
  - App bisa di-install ke home screen (manifest, ikon, service worker).
  - Trip yang terakhir dibuka bisa dilihat saat offline (read-only) dengan penanda "offline — data per {waktu}".
  - Aksi edit dinonaktifkan saat offline dengan pesan yang jelas.

### F11. Dashboard trip — P0
- AC: daftar trip milik user & trip yang diikuti (dipisah), dengan judul, tujuan, tanggal, jumlah member; aksi buat trip baru; arsip trip (owner).

## 7. Di luar scope MVP

| Item | Kapan |
|---|---|
| Expense & split bill multi-currency | Fase 2 ([[Roadmap]]) |
| Booking tiket/hotel, upload dokumen/tiket | Belum direncanakan |
| Chat AI bebas (asisten perjalanan) | Belum direncanakan |
| Push notification, native app | Belum direncanakan |
| Estimasi waktu tempuh antar tempat (routing) | Nanti, bila ada provider gratis yang memadai |
| Rating & foto tempat | Bila pindah ke Google Places (berbayar) |
| Edit offline + sinkronisasi konflik | Belum direncanakan |
| Role viewer (read-only member) | Belum direncanakan |

## 8. User flows utama

1. **Buat & generate:** Dashboard → Buat trip (F2) → "Susun dengan AI" → progres outline → progres per hari → verifikasi → halaman trip (draft).
2. **Rapikan:** Halaman trip → pindah/urutkan aktivitas, tarik dari pool ide, regenerate hari, ganti aktivitas dengan alternatif.
3. **Undang:** Pengaturan trip → Undang → salin link → kirim ke teman.
4. **Join:** Teman buka link → preview → isi nama (CAPTCHA) → halaman trip.
5. **Klaim ulang:** Teman di HP baru → buka link → "Saya sudah pernah join sebagai Budi" → menunggu → owner setujui → masuk.
6. **Cabut:** Pengaturan → Member → Cabut → member kehilangan akses.
7. **Fallback AI:** Kuota habis/gagal → "Pakai AI di luar app" → salin prompt → tempel JSON → validasi → verifikasi.

## 9. Kebutuhan non-fungsional

| Area | Kebutuhan |
|---|---|
| Bahasa | UI & output AI Bahasa Indonesia (lihat OQ-3 untuk UI) |
| Perangkat | Mobile-first responsif (≥ 360 px) dan nyaman di desktop untuk perencanaan |
| Performa | Halaman trip interaktif < 2,5 detik di 4G untuk trip 14 hari; generate 7 hari selesai < 2 menit termasuk verifikasi (dipengaruhi rate limit free tier) |
| Aksesibilitas | Target WCAG 2.1 AA untuk kontras, fokus keyboard, label form; drag & drop selalu punya alternatif non-drag |
| Privasi | Data ke provider AI hanya konteks perjalanan; guest hanya memberi nama |
| Keamanan | RLS di semua tabel; secret hanya server; lihat [[Security]] |
| Biaya | $0/bulan pada free tier; provider bisa diganti via config tanpa refactor |
| Keandalan | Supabase free di-pause setelah ±7 hari tidak aktif — mitigasi di [[Free-Tier-Limits]] |
| Observability | Log setiap panggilan AI (provider, model, status, token, durasi) di `ai_generations`; error server tercatat di log Vercel |

## 10. Dependensi & batasan

- Supabase (DB, Auth, Realtime) — free tier.
- Vercel (hosting Next.js, cron) — free (Hobby) tier.
- Gemini API — free tier; data free tier dapat dipakai Google untuk pengembangan produk.
- OSM Nominatim publik — ≤ 1 req/detik global, User-Agent wajib, tanpa autocomplete, atribusi wajib.
- Cloudflare Turnstile — CAPTCHA gratis untuk sesi anonim.
- Penyedia tile peta gratis — dipilih & diverifikasi saat implementasi.
- Rincian & sumber: [[Free-Tier-Limits]].

## 11. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Scope creep → proyek mangkrak | Tinggi | PRD ketat, P0/P1, fase 2 terpisah; perubahan scope wajib ADR |
| Kualitas AI free tier rendah / halusinasi | Sedang | Verifikasi tempat wajib, badge jujur, regenerate granular, mode import ke model lain |
| Kuota/rate limit free tier berubah tanpa pemberitahuan | Sedang | Antrean + retry/backoff, kuota internal per trip, provider bisa diganti via config |
| Supabase project ter-pause menjelang trip | Sedang | Cron keep-alive (belum terbukti), checklist cek H-7, data tidak hilang saat pause |
| Penyamaran member via link | Rendah (MVP) / Tinggi (fase 2) | Klaim ulang butuh persetujuan owner, opsi tautkan Google, reset link |
| Pelanggaran kebijakan Nominatim → IP diblokir | Sedang | Rate limiter global berbasis DB, cache, User-Agent jelas, tanpa autocomplete |
| Desain UI terasa generik / kosong tanpa foto | Sedang | Design system berbasis Airbnb ([[Design-System]]); pengganti foto: ikon kategori, peta, blok warna |

## 12. Open questions

| ID | Pertanyaan | Status |
|---|---|---|
| OQ-1 | Referensi visual/desain dari user | Selesai: [[Design-System]] / [[ADR-0010]] |
| OQ-2 | Sumber skill "UI UX Pro Max" dan "Ponytail" (link repo) | Selesai: terpasang di `.claude/skills/` ([[ADR-0011]]) |
| OQ-3 | Bahasa UI: Bahasa Indonesia saja (asumsi saat ini) atau dwibahasa? | Asumsi: Indonesia saja |
| OQ-4 | Ada trip nyata dengan tanggal tertentu yang jadi deadline MVP? | Belum dijawab |
| OQ-5 | Perilaku "generate ulang seluruh trip": pertahankan aktivitas manual/terdit (asumsi) atau timpa semua? | Asumsi: pertahankan |

## 13. Referensi
- Arsitektur: [[Tech-Stack]], [[Data-Model]], [[AI-Planner]], [[Auth-and-Access]], [[Security]], [[Testing-Strategy]]
- Keputusan: [[ADR-0001]] … [[ADR-0009]]
- Roadmap: [[Roadmap]]
