# CLAUDE.md — Traveler Handal

Aplikasi web (PWA) perencanaan perjalanan pribadi: AI menyusun draft itinerary, itinerary bisa dikolaborasikan dengan teman (solo & grup), split bill menyusul di fase 2.

## WAJIB di awal setiap session

1. Baca `vault/00-Index.md` — peta seluruh knowledge base proyek.
2. Baca `vault/04-Planning/Status.md` — fase saat ini, apa yang sedang dikerjakan, langkah berikutnya.
3. Baca entri terbaru di `vault/06-Dev-Log/`.
4. Sebelum mengubah sesuatu yang menyentuh produk/arsitektur, cek PRD (`vault/01-Product/PRD.md`) dan ADR terkait di `vault/05-Decisions/`.

## WAJIB saat bekerja

- **Keputusan arsitektur/produk baru atau perubahan keputusan** → buat ADR baru dari `vault/_templates/ADR.md` (jangan edit ADR lama yang sudah `accepted`; tandai `superseded` dan tautkan ke yang baru). Tambahkan ke `00-Index.md`.
- **Temuan teknis / gotcha / batasan layanan** → catat di `vault/07-Knowledge/` beserta sumber & tingkat keyakinan.
- **Akhir setiap session** → tulis/append `vault/06-Dev-Log/YYYY-MM-DD.md` (template `vault/_templates/Dev-Log.md`) dan update `vault/04-Planning/Status.md`.
- Jaga vault tetap jujur: kalau kode dan dokumen berbeda, perbaiki salah satunya di commit yang sama.
- Gunakan `[[wikilink]]` antar catatan dan frontmatter (`status`, `updated`, `tags`).

## Aturan proyek

- Bahasa dokumen: Bahasa Indonesia (istilah teknis boleh Inggris). Bahasa UI & output AI: Bahasa Indonesia.
- Jangan pernah mengirim data pribadi member (nama, email, catatan) ke provider AI — lihat [[ADR-0005]] / `vault/03-Architecture/AI-Planner.md`.
- Semua secret (service role Supabase, API key AI) hanya di server / env var. Tidak boleh ada di bundle client.
- Semua tabel Supabase wajib RLS + test RLS.
- Desain UI: tunggu referensi visual dari user (lihat `vault/02-Design/Design-Brief.md`) sebelum membangun UI final.
- Branch kerja & alur git mengikuti instruksi session.
