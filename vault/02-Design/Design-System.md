---
title: Design System — Traveler Handal
status: draft-review
updated: 2026-11-02
tags: [design, design-system, tokens]
---

# Design System — Traveler Handal

> Basis: referensi design system Airbnb ([[airbnb-DESIGN]], via `getdesign`). Keputusan: [[ADR-0010]].
> Aturan: **semua yang tidak di-override di sini mengikuti referensi.** Bila ada konflik, dokumen ini yang menang.

## Override utama

### 1. Primary: biru (bukan Rausch pink)
| Token | Referensi Airbnb | **Traveler Handal** | Kontras teks putih |
|---|---|---|---|
| `primary` | #ff385c | **#2563eb** | 5,17 : 1 (lolos AA) |
| `primary-active` | #e00b41 | **#1d4ed8** | 6,70 : 1 |
| `primary-disabled` | #ffd1da | **#bfdbfe** | — (status nonaktif; selalu sertai `cursor: not-allowed` + `aria-disabled`) |
| `primary-soft` *(baru)* | — | **#eff6ff** | latar badge/seleksi/hari aktif |
| `on-primary` | #ffffff | #ffffff | |

Catatan: Rausch asli dengan teks putih hanya 3,52 : 1 (gagal AA untuk teks normal). Biru yang dipilih justru memperbaiki aksesibilitas.

### 2. Warna lain
- `legal-link` (#428bff) **dihapus** → semua link memakai `primary`, supaya tidak ada dua biru.
- `luxe`, `plus` (aksen sub-brand Airbnb) **tidak dipakai**.
- `error` tetap #c13515. Keuntungan biru: error merah tidak lagi tertukar dengan warna brand.
- Token status verifikasi tempat (baru, lihat [[PRD]] F4):
  | Status | Teks | Latar |
  |---|---|---|
  | verified | #15803d | #f0fdf4 |
  | unverified | #b45309 | #fffbeb |
  | manual | `muted` #6a6a6a | `surface-soft` #f7f7f7 |
  Status tidak boleh hanya dibedakan lewat warna → selalu ada ikon + label teks.
- Netral (`ink` #222222, `body` #3f3f3f, `muted`, `hairline`, `canvas`, `surface-*`): **ikut referensi**.

### 3. Tipografi: Inter, bukan Airbnb Cereal
- Airbnb Cereal VF adalah font berlisensi milik Airbnb → **tidak boleh dipakai**.
- Pakai **Inter** (open source, juga disebut sebagai pengganti terdekat oleh referensi), dimuat via `next/font`. Stack: `Inter, -apple-system, system-ui, Roboto, "Helvetica Neue", sans-serif`.
- Skala ukuran, bobot, dan line-height ikut referensi (display 22–28px bobot 500–700, body 16/14px bobot 400). Line-height display dikurangi ±2% sesuai catatan referensi.

### 4. Bukan tiruan Airbnb
Yang diambil hanya **gaya** (kanvas putih, satu warna aksen, radius lembut, pill search, satu tier shadow). **Tidak** memakai logo, nama, ikon ilustrasi, wordmark, atau copy Airbnb. Nama & identitas app tetap Traveler Handal.

## Diambil dari referensi tanpa perubahan
- **Radius:** none 0 · xs 4 · sm 8 (button) · md 14 (kartu) · lg 20 · xl 32 · full 9999 (pill, orb)
- **Spacing:** 2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64
- **Elevation:** datar sebagai default; satu shadow `rgba(0,0,0,.02) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 6px, rgba(0,0,0,.1) 0 4px 8px` untuk kartu saat hover, search bar, dropdown; scrim modal hitam 50%.
- **Komponen:** button primary/secondary, pill CTA, search orb, kartu, top nav — dengan warna override di atas.

## Adaptasi karena konteks app berbeda
**Gaya Airbnb bertumpu pada foto, sedangkan MVP kita tidak punya foto tempat** (OSM tidak menyediakan foto; foto baru ada bila pindah ke Google Places). Tanpa adaptasi, layout bergaya Airbnb akan terasa kosong. Pengganti visual:
- **Kartu hari/aktivitas:** ikon kategori (kuliner, alam, museum, dll.) di tile `primary-soft`, nomor urut, jam & durasi sebagai hierarki utama.
- **Peta** sebagai elemen visual utama di halaman trip (desktop: daftar hari + peta berdampingan).
- **Kartu trip di dashboard:** blok warna/gradien lembut per trip + nama kota besar, bukan foto.
- Opsional nanti: foto dari sumber berlisensi bebas (mis. Wikimedia Commons); perlu atribusi & verifikasi lisensi.

## Pemetaan ke kode
- Token diwujudkan sebagai CSS variable di `src/app/globals.css` lalu dipetakan ke tema Tailwind + shadcn/ui (`--primary`, `--ring`, `--radius`, dll.).
- Pustaka komponen tetap shadcn/ui, dengan gaya disesuaikan token di atas.

## Belum diputuskan
- Dark mode: **tidak di MVP** (referensi hanya punya mode terang). Struktur token tetap dibuat agar bisa ditambah nanti.
