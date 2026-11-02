---
title: Implementation Plan — Fase 1 (MVP)
status: active
updated: 2026-11-02
tags: [planning, implementation]
---

# Implementation Plan — Fase 1 (MVP)

Sumber scope: [[PRD]] F1–F11. Arsitektur: [[Tech-Stack]], [[Data-Model]], [[AI-Planner]], [[Auth-and-Access]], [[Security]], [[Testing-Strategy]]. Desain: [[Design-System]].

Dieksekusi multi-agent dalam dua gelombang. Setiap work package (WP) **memiliki** direktori tertentu; WP lain tidak boleh menulis di sana. Kontrak di bawah adalah antarmuka antar-WP.

## Versi terpasang (scaffold 2026-11-02)
Next.js 16.4.4 (App Router, `src/`, `proxy.ts` menggantikan middleware, `cacheComponents: false`), React 19.3, Tailwind 4.3, TypeScript 5.9, zod 4, @supabase/supabase-js 2.118 + @supabase/ssr 0.12, @google/genai 2.32, TanStack Query 5, react-hook-form 7, dnd-kit (core 6 / sortable 10), maplibre-gl 6, radix-ui (paket gabungan), lucide-react, Vitest 5, Playwright 1.64 (browser terpasang 1.63 di `/opt/pw-browsers/chromium`).

> shadcn CLI tidak bisa dipakai di container (registry diblokir) → primitives ditulis manual gaya shadcn di atas `radix-ui`, digaya token [[Design-System]].

## Gelombang 1 — fondasi (paralel)

| WP | Pemilik direktori | Isi |
|---|---|---|
| **W1-DB** | `supabase/**`, `src/types/database.ts`, `vitest.db.config.ts` | Migration skema + enum + RLS + fungsi + realtime publication; harness test RLS di Postgres lokal (shim `auth`); tipe `Database` |
| **W1-UI** | `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/**`, `src/lib/utils.ts` | Token CSS + tema Tailwind, font Inter, primitives UI, app shell, badge verifikasi, ikon kategori |
| **W1-CORE** | `src/lib/schemas/**`, `src/lib/ordering.ts`, `src/lib/env.ts`, `src/lib/supabase/**`, `src/features/ai/*.ts` (non-UI), `src/features/places/*.ts` | Schema zod, ordering, env, klien Supabase, `ItineraryGenerator` (Gemini + fake), prompt builder, kuota, `PlaceVerifier` (Nominatim + fake), rate limiter, pipeline verifikasi + unit test |

## Gelombang 2 — fitur (paralel, setelah gelombang 1)

| WP | Pemilik direktori | Fitur PRD |
|---|---|---|
| **W2-TRIPS** | `src/proxy.ts`, `src/app/login/**`, `src/app/auth/**`, `src/app/trips/page.tsx`, `src/app/trips/new/**`, `src/app/trips/[tripId]/edit/**`, `src/features/trips/**` | F1, F2, F11 |
| **W2-ITIN** | `src/app/trips/[tripId]/page.tsx` (+ `layout.tsx`, `loading.tsx`), `src/features/itinerary/**`, `src/features/map/**` | F5 (UI pool), F6, F7, F9 |
| **W2-MEMBERS** | `src/app/join/**`, `src/app/trips/[tripId]/settings/**`, `src/app/revoked/**`, `src/features/members/**` | F8 |
| **W2-AI** | `src/app/api/ai/**`, `src/app/api/places/**`, `src/features/ai/components/**`, `src/features/ai/server/**`, `src/features/places/server/**` | F3, F4, F5 (generate ide), F6a, F6b |
| **W2-PLATFORM** | `src/app/manifest.ts`, `public/**`, `src/app/api/cron/**`, `src/features/offline/**`, `next.config.ts` (header), `.github/**`, `tests/e2e/**`, `playwright.config.ts` | F10, cron, header keamanan, CI, E2E |

## Kontrak antar-WP

### Rute
- `/` → redirect: login ⇒ `/trips`, belum ⇒ `/login`.
- `/login`, `/auth/callback` (OAuth code exchange, param `next`), `/trips`, `/trips/new`, `/trips/[tripId]`, `/trips/[tripId]/edit`, `/trips/[tripId]/settings`, `/join/[token]`, `/revoked`.
- API: `POST /api/ai/outline|day|ideas|alternatives|import`, `POST /api/places/search`, `POST /api/places/verify` (verifikasi ulang 1 aktivitas), `GET /api/cron/cleanup`.

### Database (W1-DB) — mengikuti [[Data-Model]] persis
- Enum: `trip_pace (santai,sedang,padat)`, `budget_level (hemat,sedang,mewah)`, `trip_status (active,archived)`, `member_role (owner,member)`, `claim_status (pending,approved,rejected)`, `verification_status (verified,unverified,manual,none)`, `activity_source (ai,manual,import)`, `ai_kind (outline,day,ideas,alternatives,import)`, `ai_status (pending,success,failed)`, `place_provider (osm,google)`.
- RPC (dipanggil via `supabase.rpc`):
  - `create_trip(p_title text, p_country_code text, p_cities text[], p_start_date date, p_end_date date, p_travelers_count int, p_interests text[], p_interests_note text, p_pace trip_pace, p_budget_level budget_level) → uuid`
  - `update_trip_dates(p_trip_id uuid, p_start_date date, p_end_date date) → void`
  - `rotate_trip_invite(p_trip_id uuid, p_token_hash text) → uuid` (owner; revoke lama + buat baru, `expires_at = end_date + 7 hari`; token dibuat & di-hash di server Next.js)
  - `get_invite_preview(p_token text) → table(trip_id, title, owner_name, start_date, end_date)` (bisa dipanggil `anon`; kosong bila invalid/kedaluwarsa/dicabut)
  - `list_claimable_members(p_token text) → table(member_id, display_name)` (member aktif non-owner yang `profiles.is_anonymous`)
  - `join_trip(p_token text, p_display_name text) → uuid` (idempoten bila sudah member aktif)
  - `request_member_claim(p_token text, p_member_id uuid) → uuid`
  - `decide_member_claim(p_claim_id uuid, p_approve bool) → void`
  - `my_claim_status(p_claim_id uuid) → claim_status`
  - `rebalance_positions(p_trip_id uuid, p_day_id uuid) → void` (`p_day_id` null = pool)
- Fungsi token: SQL meng-hash `encode(sha256(convert_to(p_token,'utf8')),'hex')`; server Next.js memakai hash yang sama (hex sha256 dari token base64url).
- Trigger: `handle_new_user` (auth.users → profiles, sinkron `is_anonymous`, `display_name` dari metadata `full_name`/`name`), `updated_at` otomatis, `activities.updated_by = auth.uid()` bila ada.
- Realtime: `days`, `activities`, `trip_members`, `member_claims`, `trips` masuk publication `supabase_realtime`.
- Tipe TS: `src/types/database.ts` mengekspor `Database` (format `supabase gen types`) + alias `Tables<'activities'>` dsb.

### Library (W1-CORE)
- `@/lib/env` — `serverEnv()` (server-only, zod, lazy) & `publicEnv` (NEXT_PUBLIC_*).
- `@/lib/supabase/client` → `createClient()` (browser) · `@/lib/supabase/server` → `createClient()` (async, cookies) · `@/lib/supabase/admin` → `createAdminClient()` (service role, `server-only`) · `@/lib/supabase/proxy` → `updateSession(request)` (dipakai `src/proxy.ts`).
- `@/lib/schemas/trip` — `CATEGORIES`, `INTERESTS` (label Indonesia), `tripFormSchema` (validasi F2).
- `@/lib/schemas/itinerary` — `outlineResultSchema`, `dayResultSchema`, `ideasResultSchema`, `alternativesResultSchema`, `importPayloadSchema` + tipe; satu sumber untuk Gemini, import, validasi server. Juga `jsonSchemaFor(kind)` untuk prompt import.
- `@/lib/ordering` — `positionBetween(a?: number, b?: number)`, `needsRebalance(a,b)`, `POSITION_STEP = 1024`.
- `@/features/ai` — `ItineraryGenerator` (sesuai [[AI-Planner]]), `getGenerator()` (per `AI_PROVIDER`), `buildTripContext(trip)` (whitelist field — tanpa data pribadi), `buildImportPrompt(ctx)`, `checkQuota(...)`, error bertipe `AiError` (`code: 'invalid_output'|'rate_limited'|'blocked'|'upstream'`).
- `@/features/places` — `PlaceVerifier`, `getVerifier()`, `normalizeQuery`, `haversineKm`, `pickCandidate`, `verifyActivities(admin, tripId, activityIds)` (pipeline cache → rate limit → Nominatim → upsert places → update aktivitas).

### UI (W1-UI) — `@/components/ui/*`
`button` (variant `primary|secondary|tertiary|pill|ghost|destructive`, size `md|sm|icon`), `input`, `textarea`, `label`, `field` (label + error + hint), `card`, `badge`, `dialog`, `alert-dialog`, `dropdown-menu`, `sheet` (mobile), `tabs`, `toast` (+ `useToast`, mendukung aksi "Urungkan"), `skeleton`, `checkbox`, `switch`, `select`, `spinner`, `empty-state`. Komponen domain: `@/components/verification-badge` (`status`), `@/components/category-icon` (`category`), `@/components/app-shell` (top nav + container), `@/components/osm-attribution`.

### Komponen lintas WP gelombang 2
- W2-AI mengekspor dari `@/features/ai/components`: `GenerateTripButton({ tripId, hasActivities })`, `GenerateProgress` (dirender oleh tombol), `RegenerateDayDialog({ tripId, dayId, open, onOpenChange })`, `AlternativesDialog({ tripId, activityId, open, onOpenChange })`, `ImportDialog({ tripId, open, onOpenChange })`, `GenerateIdeasButton({ tripId })`.
- W2-AI mengekspor `@/features/places/components`: `PlaceSearch({ countryCode, onSelect(place) })` (tombol "Cari", bukan as-you-type).
- W2-MEMBERS mengekspor `@/features/members/components`: `PendingClaimsBadge({ tripId })`, `SecureAccountButton()` (link identitas Google untuk guest).
- W2-ITIN memakai komponen di atas di halaman trip; data trip dimuat via TanStack Query + invalidasi dari Realtime.
- W2-PLATFORM mengekspor `@/features/offline`: `saveTripSnapshot(tripId, data)`, `loadTripSnapshot(tripId)`, `useOnline()`; W2-ITIN memanggilnya.

## Hasil gelombang 1 — koreksi kontrak (WAJIB dibaca gelombang 2)
- `serverEnv()` ada di `@/lib/env.server` (bukan `@/lib/env`). `@/features/ai` & `@/features/places` (index) **server-only**; komponen client mengimpor `@/features/ai/prompts`, `@/features/ai/context`, `@/features/ai/quota`, `@/lib/schemas/*` langsung.
- Error RPC: `error.message` = kode stabil (`invalid_dates`, `invite_invalid`, `access_revoked`, `forbidden`, `claim_expired`, `claimant_already_member`, …), `error.hint` = teks Indonesia untuk ditampilkan.
- **Kirim hanya kolom yang berubah** pada update (column-level grant; lihat [[Supabase-Gotchas]]). Tanggal trip hanya via `update_trip_dates`.
- `trip_members` SELECT juga mengembalikan baris milik sendiri yang sudah dicabut → client mendeteksi "dicabut" (juga via Realtime) dan mengarahkan ke `/revoked`.
- `profiles`: user hanya bisa melihat profilnya sendiri → nama member diambil dari `trip_members.display_name`.
- `create_trip`: `p_interests_note`, `p_pace`, `p_budget_level` opsional. `rebalance_positions(p_trip_id, p_day_id default null)`.
- `positionBetween(undefined, after)` = `after − 1024`. `verification_status='verified'` wajib punya `place_id`.
- `AiError.message` aman ditampilkan. Fake: instruksi berisi `paksa-gagal` → FakeGenerator gagal `upstream`; query berisi `tidak-ada` → FakeVerifier null.
- Gemini: backoff 429 s.d. ±14 dtk + timeout 40 dtk → route AI wajib `export const maxDuration` (cek batas Vercel Hobby).
- Test yang mengimpor modul `server-only` perlu `vi.mock("server-only", () => ({}))`.
- Realtime DELETE hanya membawa PK → refetch.

## Aturan untuk semua agent
- Baca `CLAUDE.md`, skill `ponytail` (`.claude/skills/ponytail/SKILL.md`), dan untuk UI: [[Design-System]] + `.claude/skills/ui-ux-pro-max/references/pro-rules.md`.
- Next.js 16 berbeda dari ingatan: baca `node_modules/next/dist/docs/` sebelum memakai API Next.
- UI & pesan error Bahasa Indonesia. Tanpa `dangerouslySetInnerHTML`. Secret hanya server (`server-only`).
- Jangan menambah dependensi; jangan `git commit` (orkestrator yang commit).
- Selesai bila `pnpm typecheck`, `pnpm lint`, dan test milik WP lulus untuk file WP itu.

## Status WP
Lihat [[Status]].
