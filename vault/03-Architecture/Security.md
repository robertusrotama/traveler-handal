---
title: Security
status: draft-review
updated: 2026-11-02
tags: [architecture, security]
---

# Security Checklist

Terkait: [[Auth-and-Access]], [[Data-Model]], [[AI-Planner]].

| Area | Kontrol | Diverifikasi oleh |
|---|---|---|
| Akses data | RLS di semua tabel; fungsi SECURITY DEFINER memvalidasi input & `search_path` dikunci | Test RLS per peran (owner, member, member dicabut, guest, orang luar, anon tanpa keanggotaan) |
| Secret | Service role key, `GEMINI_API_KEY`, secret Turnstile hanya di env server; modul berisi secret memakai guard `server-only` | Build check + review |
| Token undangan | Acak 32 byte, disimpan sebagai hash, satu aktif per trip, kedaluwarsa | Unit + integrasi |
| Penyamaran member | Klaim ulang butuh persetujuan owner; opsi tautkan Google | E2E klaim |
| Penyalahgunaan anonim | Turnstile saat sign-in anonim; rate limit endpoint join & AI | Integrasi |
| Endpoint AI | Auth + izin `can_use_ai` + kuota trip + validasi input zod + batas panjang instruksi (≤ 500 karakter) | Integrasi |
| Prompt injection | Input user dibungkus sebagai data; output wajib lolos schema; teks AI dirender sebagai teks (tanpa `dangerouslySetInnerHTML`) | Unit + review |
| XSS | React escaping default; tidak ada HTML dari AI/user yang dirender mentah; link Maps dibangun dari koordinat, bukan dari teks AI | Review |
| Privasi | Hanya konteks perjalanan ke provider AI; guest hanya memberi nama; log error tanpa data pribadi | Review prompt builder (unit test memastikan field pribadi tidak ada) |
| Kebijakan pihak ketiga | Nominatim: ≤1 req/dtk, User-Agent, atribusi, cache; tile peta sesuai kebijakan penyedia | Unit test rate limiter + review |
| Dependensi | `pnpm audit` di CI; Dependabot/Renovate (opsional) | CI |
| Header | CSP dasar, `X-Content-Type-Options`, `Referrer-Policy` via konfigurasi Next.js | Review |
