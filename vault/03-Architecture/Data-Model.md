---
title: Data Model
status: draft-review
updated: 2026-11-02
tags: [architecture, database, rls]
---

# Data Model

Postgres (Supabase). Semua tabel **RLS aktif**. Keputusan terkait: [[ADR-0004]], [[ADR-0006]], [[ADR-0007]], [[ADR-0008]].

## Diagram ringkas

```
profiles ─────────┐
  id (= auth.users.id)  display_name, avatar_url, is_anonymous
                  │
trips ◄───────────┤ owner_id
   │
   ├── trip_members          (trip_id, user_id)  ← kunci split bill fase 2
   ├── trip_invites
   ├── member_claims         permintaan klaim ulang identitas
   ├── days
   │     └── activities      day_id NULL = pool ide
   └── ai_generations

places            data tempat ter-cache (provider-agnostic)
geocode_cache     query ternormalisasi → place | not_found
rate_limits       state rate limiter global (Nominatim)
```

## Tabel

### `profiles`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| display_name | text | |
| avatar_url | text null | |
| is_anonymous | bool | disinkronkan dari auth |
| created_at | timestamptz | |

### `trips`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid → profiles | |
| title | text | |
| country_code | text | ISO 3166-1 alpha-2 |
| cities | text[] | ≥ 1 |
| start_date, end_date | date | end ≥ start; durasi 1–21 hari |
| travelers_count | int | ≥ 1 |
| interests | text[] | + `interests_note` text null |
| pace | enum `santai \| sedang \| padat` | |
| budget_level | enum `hemat \| sedang \| mewah` | |
| status | enum `active \| archived` | |
| created_at, updated_at | timestamptz | |

### `trip_members`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | dipakai sebagai referensi stabil (expense fase 2) |
| trip_id | uuid → trips | |
| user_id | uuid → profiles | unique (trip_id, user_id) untuk member aktif |
| display_name | text | nama di trip ini |
| role | enum `owner \| member` | tepat satu owner per trip |
| can_use_ai | bool | owner selalu true |
| joined_at | timestamptz | |
| revoked_at | timestamptz null | dicabut = tidak dihapus |

### `trip_invites`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid → trips | maksimal satu invite aktif per trip (partial unique index `where revoked_at is null`) |
| token_hash | text | SHA-256 dari token; token asli tidak disimpan |
| created_by | uuid → profiles | |
| expires_at | timestamptz | default `end_date + 7 hari` |
| revoked_at | timestamptz null | |
| created_at | timestamptz | |

### `member_claims`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid → trips | |
| member_id | uuid → trip_members | baris yang diklaim |
| claimant_user_id | uuid → profiles | sesi baru yang mengklaim |
| status | enum `pending \| approved \| rejected` | |
| decided_by | uuid null | owner |
| created_at, decided_at | timestamptz | |

### `days`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid → trips | unique (trip_id, day_index) |
| day_index | int | 0-based |
| date | date | |
| title | text null | tema hari |
| city | text null | |
| notes | text null | |

### `activities`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid → trips | denormalisasi untuk RLS & realtime filter |
| day_id | uuid null → days | NULL = pool ide |
| position | double precision | fractional ordering dalam satu hari/pool |
| title | text | |
| why | text null | alasan singkat dari AI |
| category | text | enum lunak (kuliner, alam, ...) |
| start_time | time null | jam lokal tanpa zona waktu |
| duration_min | int null | |
| search_query | text null | wajib untuk `source = ai/import` |
| place_id | uuid null → places | |
| verification_status | enum `verified \| unverified \| manual \| none` | `none` = aktivitas manual tanpa tempat |
| source | enum `ai \| manual \| import` | |
| edited_by_user | bool | true setelah diedit manusia (dipakai OQ-5) |
| notes | text null | |
| created_by, updated_by | uuid → profiles | |
| created_at, updated_at | timestamptz | |

### `ai_generations`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid → trips | |
| requested_by | uuid → profiles | |
| kind | enum `outline \| day \| ideas \| alternatives \| import` | satu baris per panggilan provider (termasuk retry) |
| target_day_id | uuid null | |
| provider, model | text | |
| status | enum `pending \| success \| failed` | |
| input_tokens, output_tokens | int null | |
| duration_ms | int null | |
| error | text null | tanpa data pribadi |
| created_at | timestamptz | dipakai menghitung kuota harian trip |

### `places`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| provider | enum `osm \| google` | unique (provider, provider_place_id) |
| provider_place_id | text | OSM: `{osm_type}{osm_id}` |
| name | text | |
| lat, lng | double precision | |
| address | text null | |
| category | text null | |
| opening_hours | text null | tag OSM mentah bila ada |
| raw | jsonb | respons provider |
| fetched_at | timestamptz | |

### `geocode_cache`
| Kolom | Tipe | Catatan |
|---|---|---|
| query_normalized | text | PK bersama `country_code` |
| country_code | text | |
| place_id | uuid null → places | NULL = not_found |
| fetched_at | timestamptz | not_found kedaluwarsa setelah 30 hari agar bisa dicoba ulang |

### `rate_limits`
| Kolom | Tipe | Catatan |
|---|---|---|
| key | text PK | mis. `nominatim` |
| last_request_at | timestamptz | dipakai dengan row lock agar ≤ 1 req/detik global |

## Fungsi database (SECURITY DEFINER, dengan validasi ketat)
- `is_trip_member(trip_id) → bool` — member aktif.
- `is_trip_owner(trip_id) → bool`.
- `join_trip(token text, display_name text) → trip_id` — validasi hash token, belum dicabut/kedaluwarsa; insert `trip_members`.
- `request_member_claim(token text, member_id uuid) → claim_id`.
- `decide_member_claim(claim_id uuid, approve bool)` — owner saja; bila approve, pindahkan `user_id` baris member ke claimant.
- `create_trip(...)` — insert trip + days + member owner dalam satu transaksi.
- `update_trip_dates(trip_id, start_date, end_date)` — owner saja; tambah/hapus `days`, aktivitas dari hari terhapus dipindah ke pool (`day_id = NULL`), geser `date` semua hari, perbarui `expires_at` undangan aktif.

## Aturan RLS

| Tabel | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| trips | member aktif | insert: user non-anonim (via `create_trip`); update/delete: owner |
| trip_members | member aktif trip tsb | owner (cabut, izin AI); insert hanya via `join_trip`/`create_trip` |
| trip_invites | owner | owner |
| member_claims | owner trip + claimant sendiri | insert via fungsi; update via `decide_member_claim` |
| days | member aktif | update tema/kota/catatan: member aktif; insert/delete: hanya via `create_trip` dan `update_trip_dates` (owner) |
| activities | member aktif | member aktif |
| ai_generations | member aktif | server saja (service role) |
| places, geocode_cache | user terautentikasi | server saja (service role) |
| rate_limits | tidak ada | server saja |

## Ordering (fractional position)
- Sisip di antara A dan B: `(A.position + B.position) / 2`; di akhir: `last + 1024`.
- Bila selisih < 1e-6, rebalance seluruh hari/pool (urut ulang dengan jarak 1024) dalam satu transaksi.

## Waktu
- `start_time` = jam lokal tempat tujuan, tanpa zona waktu. Tidak ada konversi zona waktu di MVP.

## Fase 2 (didesain, belum dibangun)
- `expenses`: id, trip_id, paid_by → trip_members, amount numeric, currency, fx_rate_to_base, base_currency, category, spent_at, note.
- `expense_splits`: expense_id, member_id → trip_members, share_amount.
