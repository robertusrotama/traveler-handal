---
title: Tech Stack
status: draft-review
updated: 2026-11-02
tags: [architecture, stack]
---

# Tech Stack

Keputusan: [[ADR-0002]] (PWA), [[ADR-0003]] (Next.js + Supabase + Vercel), [[ADR-0005]] (provider gratis).

> Versi pustaka: gunakan versi stabil terbaru saat scaffold dan catat versi yang dipakai di sini. Jangan berasumsi API dari ingatan — cek dokumentasi resmi.

## Ringkasan

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Bahasa | TypeScript (strict) | Satu bahasa untuk client, server, dan test |
| Framework | Next.js (App Router) | Server Components + Route Handlers / Server Actions |
| Styling & UI | Tailwind CSS + shadcn/ui (Radix) | Tema final menunggu [[Design-Brief]] |
| Data fetching client | TanStack Query | Cache + invalidasi dari event Realtime |
| Form & validasi | react-hook-form + zod | Schema zod dipakai bersama client/server/AI |
| Drag & drop | dnd-kit | Wajib ada alternatif non-drag (aksesibilitas) |
| Peta | MapLibre GL JS + tile OSM gratis | Kandidat tile: penyedia tanpa API key — **verifikasi kebijakan saat implementasi** |
| PWA | Serwist (kandidat) | Manifest + service worker; cache trip terakhir di IndexedDB |
| Database | Supabase Postgres | RLS di semua tabel |
| Auth | Supabase Auth | Google (owner), anonymous sign-in (guest), identity linking |
| Realtime | Supabase Realtime (Postgres Changes) | Menghormati RLS — **wajib dites** |
| AI | `ItineraryGenerator` → implementasi Gemini (SDK resmi `@google/genai`) | + implementasi `ManualImport`; Claude API bisa ditambah nanti |
| Geocoding | `PlaceVerifier` → implementasi Nominatim | Rate limiter global berbasis Postgres |
| CAPTCHA | Cloudflare Turnstile | Untuk sesi anonim (didukung Supabase Auth) |
| Hosting | Vercel (Hobby) | Env var untuk secret; Vercel Cron untuk job berkala |
| Test | Vitest, Supabase CLI (DB lokal) untuk test RLS, Playwright (E2E) | Lihat [[Testing-Strategy]] |
| Kualitas kode | ESLint, Prettier, `tsc --noEmit` | Dijalankan di CI (GitHub Actions) |
| Package manager | pnpm | |

## Struktur repo (usulan)

```
traveler-handal/
├── CLAUDE.md
├── vault/                      # knowledge base (Obsidian)
├── supabase/
│   ├── migrations/             # SQL migration (skema + RLS + fungsi)
│   ├── seed.sql
│   └── tests/                  # test RLS (SQL / pgTAP atau via Vitest)
├── src/
│   ├── app/                    # route Next.js
│   │   ├── (auth)/login/
│   │   ├── trips/              # dashboard, buat trip
│   │   ├── trips/[tripId]/     # halaman trip, pengaturan, member
│   │   ├── join/[token]/       # alur join guest
│   │   └── api/                # route handler: ai/*, places/*, cron/*
│   ├── components/             # UI (shadcn) + komponen fitur
│   ├── features/
│   │   ├── trips/
│   │   ├── itinerary/          # editor, ordering, pool ide
│   │   ├── members/            # undangan, join, klaim, cabut
│   │   ├── ai/                 # ItineraryGenerator + implementasi + prompt
│   │   └── places/             # PlaceVerifier + implementasi + rate limiter
│   ├── lib/
│   │   ├── supabase/           # client browser, server, service role (server-only)
│   │   ├── schemas/            # zod: trip, itinerary AI output, dll.
│   │   └── ordering.ts         # fractional position
│   └── types/                  # tipe hasil generate dari Supabase
├── tests/e2e/                  # Playwright
└── .github/workflows/ci.yml
```

## Prinsip
- **Batas modul jelas:** `features/ai` tidak tahu soal UI; `features/places` tidak tahu soal AI; keduanya diakses lewat antarmuka.
- **Secret server-only:** modul service role diberi guard `server-only` agar build gagal bila terimpor di client.
- **Schema tunggal:** satu schema zod untuk output itinerary dipakai oleh provider AI, mode import, dan validasi server.
