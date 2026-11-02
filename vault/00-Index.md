---
title: Index — Traveler Handal
status: active
updated: 2026-11-02
tags: [index, moc]
---

# Traveler Handal — Peta Isi

> Titik masuk knowledge base. Mulai dari sini setiap session.

## Status saat ini
- [[Status]] — fase, pekerjaan aktif, langkah berikutnya

## 01 · Product
- [[PRD]] — Product Requirements Document (sumber kebenaran scope & acceptance criteria)
- [[Roadmap]] — fase MVP → fase 2 → nanti

## 02 · Design
- [[Design-Brief]] — menunggu referensi visual dari user; skill desain yang diminta

## 03 · Architecture
- [[Tech-Stack]] — stack, struktur repo, library
- [[Data-Model]] — skema database & aturan RLS
- [[AI-Planner]] — alur generate, verifikasi tempat, anti-halusinasi, kuota
- [[Auth-and-Access]] — owner, guest anonim, undangan, klaim ulang, pencabutan
- [[Security]] — checklist keamanan
- [[Testing-Strategy]] — unit, integrasi (RLS), E2E

## 04 · Planning
- [[Status]]
- Implementation plan — *dibuat setelah PRD disetujui*

## 05 · Decisions (ADR)
- [[ADR-0001]] Fokus masalah & scope MVP
- [[ADR-0002]] Platform: web responsif + PWA
- [[ADR-0003]] Stack: Next.js + Supabase + Vercel
- [[ADR-0004]] Akses hybrid: owner login + guest anonim
- [[ADR-0005]] Provider gratis: Gemini + import manual, OSM Nominatim
- [[ADR-0006]] Hak pakai AI, kuota per trip, output Bahasa Indonesia
- [[ADR-0007]] Konkurensi: last-write-wins per baris
- [[ADR-0008]] Klaim ulang identitas butuh persetujuan owner; masa berlaku link
- [[ADR-0009]] Knowledge base di Obsidian vault dalam repo

## 06 · Dev Log
- [[2026-11-02]] — brainstorming & PRD

## 07 · Knowledge
- [[Free-Tier-Limits]] — batasan Gemini, Nominatim, Supabase, Vercel (dengan sumber & confidence)

## Templates
- `_templates/ADR.md`, `_templates/Dev-Log.md`, `_templates/Feature.md`
