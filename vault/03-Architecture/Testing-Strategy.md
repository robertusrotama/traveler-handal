---
title: Testing Strategy
status: draft-review
updated: 2026-11-02
tags: [architecture, testing]
---

# Testing Strategy

Prinsip: test-driven untuk logika inti; RLS diperlakukan sebagai kode yang wajib dites; AI selalu di-mock di test otomatis (tidak memakai kuota).

## Lapisan

| Lapisan | Alat | Cakupan wajib |
|---|---|---|
| Unit | Vitest | Schema zod output AI (valid/invalid/edge), prompt builder (tanpa data pribadi), fractional ordering + rebalance, normalisasi query geocode, pemilihan kandidat berdasarkan jarak, perhitungan kuota, parsing opening_hours (best effort) |
| Integrasi DB | Supabase CLI (Postgres lokal) + Vitest/pgTAP | Setiap kebijakan RLS per peran: owner, member aktif, member dicabut, guest anonim, user luar; `join_trip` (token valid/invalid/kedaluwarsa/dicabut); `decide_member_claim`; `create_trip` transaksional; satu undangan aktif |
| Integrasi API | Vitest + route handler | Endpoint AI: tanpa izin → 403, kuota habis → 429, output invalid → retry lalu gagal; rate limiter Nominatim (≤1/dtk dengan concurrency) |
| Realtime | Test integrasi manual terdokumentasi + 1 E2E | Member dicabut tidak lagi menerima event |
| E2E | Playwright (Chromium) | Login owner (mock/seeded session) → buat trip → generate (provider mock) → edit & pindah aktivitas → undang → join guest di context browser kedua → edit terlihat realtime → cabut → akses hilang; klaim ulang + approve; mode import JSON |

## Aturan
- Provider AI & Nominatim diganti dengan implementasi fake via DI/env (`AI_PROVIDER=fake`, `PLACES_PROVIDER=fake`).
- CI (GitHub Actions): lint, typecheck, unit, integrasi DB (Supabase lokal), E2E pada PR.
- Bug yang ditemukan → test yang mereproduksi lebih dulu, baru perbaikan.
