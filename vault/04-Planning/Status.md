---
title: Status
status: active
updated: 2026-11-02
tags: [planning, status]
---

# Status Proyek

## Fase saat ini
**Fase 1 (MVP) — implementasi, gelombang 2 DITAHAN atas permintaan user (2026-11-02).**
Rencana & kontrak antar-modul: [[Implementation-Plan]]. AI ditunda: [[ADR-0012]].

## Selesai (terverifikasi)
- [x] Scaffold Next.js 16 + dependensi
- [x] W1-DB: migration skema + RLS + RPC + realtime; 68 test RLS lulus (Postgres lokal + shim); migration juga sukses diterapkan di `supabase start` lokal
- [x] W1-UI: token Design System, Inter, primitives, komponen domain
- [x] W1-CORE: schema zod, ordering, env, klien Supabase, ItineraryGenerator (Gemini + fake), PlaceVerifier (Nominatim + fake), pipeline verifikasi, rate limiter; unit test lulus

## Ditahan (WIP, belum diverifikasi, di-commit sebagai `wip`)
Agent dihentikan di tengah jalan; file parsial ada di repo. `pnpm typecheck` masih error di file WIP ini.
- W2-TRIPS: login, callback, `proxy.ts`, dashboard, form trip — parsial
- W2-ITIN: helper `src/features/itinerary/` — parsial, halaman trip belum ada
- W2-MEMBERS: actions + sebagian komponen — parsial, alur join belum lengkap
- W2-AI → dipersempit jadi **places saja** (`/api/places/*`, `PlaceSearch`) — parsial
- W2-PLATFORM: manifest, sw, offline, CI, playwright config, vercel.json — parsial

## Berikutnya (saat dilanjutkan)
1. Jalankan `pnpm typecheck` → selesaikan/rapikan file WIP per WP (lihat pembagian direktori di [[Implementation-Plan]]).
2. Lanjutkan WP gelombang 2 tanpa AI (lihat [[ADR-0012]]).
3. Integrasi, `pnpm build`, E2E di Supabase lokal (`dockerd` + `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`).

## Blocker / menunggu user
- OQ-4 (deadline trip nyata) belum dijawab.
- Verifikasi nama model Gemini (`AI_MODEL`) sebelum AI diaktifkan.
- Kredensial Google OAuth & Turnstile di dashboard Supabase.
