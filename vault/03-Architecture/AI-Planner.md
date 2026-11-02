---
title: AI Planner
status: draft-review
updated: 2026-11-02
tags: [architecture, ai, places]
---

# AI Planner & Verifikasi Tempat

Keputusan: [[ADR-0005]] (provider gratis), [[ADR-0006]] (hak akses, kuota, bahasa). Batasan layanan: [[Free-Tier-Limits]].

## Antarmuka

```ts
// features/ai
interface ItineraryGenerator {
  outline(ctx: TripContext): Promise<OutlineResult>;            // tema & kota per hari
  day(ctx: TripContext, day: DayRequest): Promise<DayResult>;   // aktivitas 1 hari
  ideas(ctx: TripContext, existing: string[]): Promise<IdeasResult>; // 8–15 ide pool
  alternatives(ctx: TripContext, slot: SlotRequest): Promise<AlternativesResult>; // 3 opsi
}
// Implementasi MVP: GeminiGenerator. Cadangan: mode import manual (bukan implementasi runtime,
// tetapi memakai schema & pipeline validasi/verifikasi yang sama).

// features/places
interface PlaceVerifier {
  verify(q: { query: string; city: string; countryCode: string; near?: LatLng }): Promise<PlaceMatch | null>;
  search(q: { text: string; countryCode?: string }): Promise<PlaceMatch[]>; // tombol "Cari"
}
// Implementasi MVP: NominatimVerifier.
```

`TripContext` hanya berisi: negara, kota, tanggal/durasi, jumlah orang, minat (+catatan minat), tempo, budget, dan untuk regenerate: judul aktivitas/tempat yang sudah ada + instruksi bebas user. **Tidak ada** nama/email member atau catatan pribadi.

## Alur generate penuh

```
Client                         Server (Route Handler)                Provider
──────                         ─────────────────────                 ────────
POST /api/ai/outline ───────►  cek auth + izin + kuota
                               panggil generator.outline ─────────► Gemini
                               validasi zod; simpan days.title/city
                     ◄───────  outline
loop hari (konkurensi 1–2):
POST /api/ai/day ───────────►  cek auth + izin + kuota
                               generator.day ─────────────────────► Gemini
                               validasi zod (retry 1x dengan pesan error bila invalid)
                               simpan activities (source=ai, unverified)
                               verifikasi tiap aktivitas ─────────► Nominatim (≤1/dtk global)
                               update place_id + status
                     ◄───────  hasil hari (realtime juga memberi tahu member lain)
```

- Orkestrasi per hari dilakukan **client** dengan request pendek per hari, sehingga tiap invokasi serverless singkat (menghindari batas durasi fungsi Vercel).
- Pool ide dihasilkan lewat **request terpisah** `POST /api/ai/ideas` (`kind = ideas`) setelah semua hari selesai, dengan daftar tempat yang sudah terjadwal sebagai konteks agar tidak duplikat — 8–15 tempat, `day_id = NULL`.
- Konkurensi panggilan AI dibatasi 1–2; pada HTTP 429 → backoff eksponensial (2s, 4s, 8s) maksimal 3 kali, lalu tandai hari gagal.

## Prompting
- System prompt (Bahasa Indonesia): peran perencana perjalanan; hanya tempat nyata & dikenal; output wajib sesuai JSON schema; **jangan** menyebut jam buka, harga tiket, atau alamat sebagai fakta; setiap aktivitas wajib `search_query` = nama tempat yang umum dipakai + kota; urutkan aktivitas agar berdekatan secara geografis.
- Input user (minat bebas, instruksi regenerate) dibungkus sebagai data dalam blok berlabel, bukan digabung ke instruksi.
- Output schema (zod, dipakai juga untuk mode import):

```ts
DayResult = {
  dayIndex: number,
  theme: string,
  city: string,
  activities: Array<{
    title: string,            // nama tempat/aktivitas
    category: Category,
    startTime: string | null, // "HH:MM"
    durationMin: number,      // 15..600
    why: string,              // ≤ 200 karakter
    searchQuery: string
  }>                          // 1..8
}

IdeasResult = {
  ideas: Array<{ title; category; why; searchQuery }>   // 8..15
}
```

## Verifikasi tempat
1. Normalisasi query (lowercase, trim, hapus tanda baca berlebih) → cek `geocode_cache`.
2. Miss → ambil giliran dari rate limiter global (`rate_limits` row lock: tunggu hingga ≥ 1 detik sejak `last_request_at`) → panggil Nominatim (`format=jsonv2`, `countrycodes`, `limit=3`, User-Agent aplikasi + kontak).
3. Pilih kandidat teratas yang berjarak ≤ 50 km dari pusat kota hari tersebut (pusat kota sendiri di-geocode & di-cache sekali).
4. Cocok → upsert `places`, set `verified`. Tidak cocok → cache `not_found` (kedaluwarsa 30 hari), set `unverified`.
5. Bila tersedia tag `opening_hours`, simpan; UI memberi peringatan bila `start_time` jelas di luar jam buka (best effort).

## Kuota & izin
- Pemicu AI: owner atau member dengan `can_use_ai = true` (dicek di server).
- Kuota harian **per trip** (default 30 panggilan/hari, config `AI_DAILY_QUOTA_PER_TRIP`), dihitung dari jumlah baris `ai_generations` dengan `kind ≠ import` dalam 24 jam terakhir. **Setiap panggilan ke provider dihitung, termasuk retry dan yang gagal**, karena semuanya memakai kuota provider. Generate penuh 7 hari = 1 outline + 7 hari + 1 ide = 9 panggilan (tanpa retry).
- Import manual tidak memotong kuota.

## Penanganan error
| Kondisi | Perilaku |
|---|---|
| Output tidak valid | Retry 1x dengan pesan validasi; gagal → hari ditandai gagal + "Coba lagi" |
| 429 / quota provider | Backoff; gagal → tawarkan mode import |
| Timeout / 5xx | Retry 1x; gagal → hari ditandai gagal |
| Konten ditolak provider | Pesan netral, tawarkan ubah instruksi / mode import |
| Nominatim gagal | Aktivitas tetap tersimpan `unverified`; bisa diverifikasi ulang manual |

## Pengganti provider
- Tambah implementasi `ItineraryGenerator` baru (mis. Claude API) + set `AI_PROVIDER` & `AI_MODEL`. Saat menambah Claude, ikuti panduan resmi Anthropic SDK (structured outputs).
- Tambah `GooglePlacesVerifier` bila pindah ke Google Places; perhatikan aturan penyimpanan data Google (simpan `place_id`, detail lain dengan batas waktu — **perlu verifikasi ToS** saat itu).
