---
title: Free Tier Limits
status: active
updated: 2026-11-02
tags: [knowledge, limits, vendors]
---

# Batasan Free Tier Layanan

> Diriset 2026-11-02. Batasan free tier sering berubah — **cek ulang sumber resmi sebelum mengandalkan angka.** Tingkat keyakinan dicantumkan per poin.

## Gemini API (free tier)
- Data input/output di free tier **dapat dipakai Google untuk meningkatkan produk** dan bisa dibaca reviewer manusia (kecuali EEA/Swiss/UK); paid tier tidak. — *Medium confidence* (dokumentasi billing Google + sumber sekunder).
- Model gratis praktis kelas **Flash / Flash-Lite**; model Pro tidak tersedia di free tier (sumber sekunder saling bertentangan soal detailnya). — *Low-medium confidence*.
- Rate limit per model **tidak lagi dipublikasikan pasti**; dilihat per project di AI Studio; limit berlaku per project, bukan per key. Angka lama (mis. 15 RPM / 1.500 RPD) kemungkinan usang. — *Low-medium confidence*.
- Dampak desain: antrean konkurensi 1–2, backoff pada 429, kuota internal per trip, tidak mengirim data pribadi. → [[AI-Planner]]

## OSM Nominatim (instance publik)
- ≤ **1 request/detik untuk seluruh aplikasi**, bukan per user; pelanggaran → blokir IP. — *Medium confidence* (konsisten di beberapa sumber; teks kebijakan resmi belum dibaca langsung: https://operations.osmfoundation.org/policies/nominatim/).
- Wajib User-Agent/Referer yang mengidentifikasi aplikasi. — *Medium confidence*.
- Wajib atribusi "© OpenStreetMap contributors"; hasil sebaiknya di-cache. — *Medium confidence*.
- Bulk geocoding & autocomplete tidak diperbolehkan di instance publik. — *Low-medium confidence* (perlu cek halaman resmi).
- Dampak desain: rate limiter global berbasis Postgres, `geocode_cache`, tombol "Cari" (bukan search-as-you-type).

## Supabase (Free plan)
- Project Free di-**pause** bila aktivitas database terlalu rendah selama ±1 minggu; plan berbayar tidak. Data tidak dihapus; restore dari dashboard. — *Medium-high confidence* (FAQ resmi Supabase).
- Batas umum: 2 project aktif per akun, ±500 MB database, ±1 GB storage. — *Medium confidence* (sumber sekunder).
- Cron keep-alive (query ringan harian) **belum terkonfirmasi resmi** mencegah pause. — *Low confidence*. Tetap lakukan checklist "cek Supabase aktif" H-7 sebelum trip.

## Vercel (Hobby)
- Batas durasi fungsi serverless & frekuensi cron di Hobby — **perlu verifikasi saat implementasi**. Desain sudah memecah generate menjadi request pendek per hari untuk mengurangi risiko.

## Peta (tile)
- Tile server resmi OSM punya kebijakan pemakaian sendiri; gunakan penyedia tile gratis yang mengizinkan pemakaian aplikasi kecil — **pilih & verifikasi saat implementasi**.

## Sumber
- https://supabase.com/kb/faqs/platform/free-project-pausing
- https://ai.google.dev/gemini-api/docs/billing
- https://apidog.com/blog/gemini-api-free-tier/
- https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/
- https://dev.to/daniel_pertu/one-request-a-second-for-the-whole-app-so-our-place-search-has-no-search-as-you-type-2lc3
- https://moltchat-agent-commons.onrender.com/wiki/Nominatim_geocoding_usage_policy_and_rate_limits (wiki tidak resmi)
