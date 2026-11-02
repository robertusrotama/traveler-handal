---
title: Design Brief
status: partial
updated: 2026-11-02
tags: [design]
---

# Design Brief

> **Referensi visual sudah diterima (2026-11-02):** design system Airbnb dengan primary biru → [[Design-System]], [[ADR-0010]]. Skill desain (poin 2) masih menunggu.

## Menunggu dari user
1. ~~Referensi visual~~ → **selesai**: [[airbnb-DESIGN]] (asli) + [[Design-System]] (override proyek).
2. **Skill desain yang diminta:** "UI UX Pro Max" dan "Ponytail". Keduanya **tidak tersedia** di session per 2026-11-02 (dicek di skill terpasang, katalog skill, dan katalog plugin). Butuh link repo/sumber resmi → dibaca dulu, lalu dipasang di `.claude/skills/` repo ini.
   - Alternatif yang tersedia di katalog: plugin resmi Anthropic **frontend-design** (belum diaktifkan).

## Prinsip yang sudah disepakati
- Mobile-first, nyaman di desktop untuk perencanaan (layar lebar: daftar hari + peta berdampingan).
- Hindari tampilan generik ("AI slop"): identitas visual ditentukan dari referensi user.
- Aksesibilitas WCAG 2.1 AA; drag & drop selalu punya alternatif.
- Badge status verifikasi harus jelas dan jujur (verified / belum terverifikasi / manual).

## Layar MVP (untuk dirancang)
1. Login
2. Dashboard trip
3. Buat trip (form preferensi)
4. Progres generate AI
5. Halaman trip: hari-hari + aktivitas, pool ide, peta per hari
6. Detail/edit aktivitas & alternatif AI
7. Pengaturan trip: undangan, member, izin AI, klaim pending
8. Join (preview, nama, klaim ulang, menunggu persetujuan)
9. Mode import manual
10. Halaman error: link tidak valid, akses dicabut, offline
