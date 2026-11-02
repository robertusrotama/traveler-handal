---
title: Roadmap
status: draft-review
updated: 2026-11-02
tags: [product, roadmap]
---

# Roadmap

Lihat [[PRD]] untuk detail scope MVP. Urutan fase mengikuti [[ADR-0001]].

## Fase 1 — MVP: AI Planner + Itinerary kolaboratif
F1–F11 di [[PRD]] (P0 wajib, P1 bila waktu cukup).
Milestone detail akan dibuat di implementation plan (`04-Planning/`) setelah PRD disetujui.

## Fase 2 — Expense & split bill
- Catat pengeluaran per trip: siapa bayar, jumlah, mata uang, kategori, tanggal.
- Pembagian: rata, persentase, nominal tertentu, sebagian member.
- Multi-currency dengan kurs tersimpan per expense (sumber kurs gratis dipilih saat fase 2).
- Ringkasan saldo & "siapa bayar ke siapa" dengan jumlah transfer minimum.
- Bergantung pada `trip_members` (sudah ada di MVP) — tabel `expenses`, `expense_splits` (lihat [[Data-Model]]).
- Prasyarat keamanan: klaim ulang identitas dengan persetujuan owner ([[ADR-0008]]) sudah berjalan.

## Nanti (belum dijadwalkan)
- Provider AI berbayar (Claude API) sebagai opsi kualitas lebih tinggi.
- Google Places untuk rating/foto/jam buka yang lebih lengkap.
- Estimasi waktu tempuh antar tempat.
- Edit offline.
- Role viewer.
