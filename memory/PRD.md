# Scaffold Safety Inspection App — PRD

## Original Problem Statement
Convert an HTML prototype of a "Scaffold Safety Inspection" app (PIN-gated field form with site/inspector/checklist/photo/signature + a per-site folder archive) into a full-stack React + FastAPI + MongoDB web app.

## User Personas
- **Field Inspector** — Logs daily/weekly scaffold safety inspections on mobile; needs fast, high-contrast, large touch targets, works outdoors.
- **Site Supervisor / Contractor** — Issues handover certificates to clients when new scaffolds are erected.
- **Client / End Customer** — Receives the handover certificate email with compliance details.

## Architecture
- **Frontend**: React 19 (CRA + craco), Tailwind, custom Swiss/high-contrast theme (Cabinet Grotesk + IBM Plex Sans), lucide-react icons, axios.
- **Backend**: FastAPI + Motor (async MongoDB).
- **Persistence**: MongoDB collections `inspections`, `handovers`.
- **Email**: Resend (`asyncio.to_thread(resend.Emails.send, ...)`) — gracefully no-ops when `RESEND_API_KEY` is empty.

## Core Requirements (static)
- 4-digit PIN gate (`ACCESS_PIN=4060`, server-verified at `/api/auth/verify-pin`).
- Site list: Unilever, Baker baker, Erl, Chane, Howdens, Iko, Byk, Cp, Um Regent.
- Inspector list: Luke Arnold, Jeff Arnold, Jon McHale, Josh McHale.
- Inspection form: site, scaffold ID, inspector, email, date, 5-item checklist (pass/fail/na), photo, notes, status (green/red), digital signature.
- Auto next-tagging-day badge (Tue/Wed/Fri rotation).
- Per-site collapsible archive with delete.
- Handover certificate form modeled on SG World paper form: contractor, client name + email, site, description, drawing/quotation no., use only for, ties tested, working lifts, distributed load + unit, sheeting designed (has/has not), contractor + received-by sign-off (name, position, signature), handover date/time, notes.
- Email is sent to client + admin on handover submit (and to inspector + admin on inspection submit).

## What's Been Implemented (Jan 2026)
- 2026-01-26 — MVP scaffolded: backend models + endpoints, full Swiss-style React UI, PIN gate, inspection form, per-site archive, signature pad, live clock. (iteration_1.json: 11/11 backend tests + frontend flows pass.)
- 2026-01-26 — Header renamed `SAFETY INSPECT.` → `SAFETY INSPECTION`. Added Handover Certificate tab + form + archive + email template + endpoints `/api/handovers` (POST/GET/DELETE). (iteration_2.json: 20/20 backend tests + frontend flows pass.)
- 2026-01-26 — Canvas `willReadFrequently:true` polish applied to silence Chromium warnings.

## Prioritized Backlog
- **P0** — Add Resend API key (user to provide) so emails actually send.
- **P1** — PDF export of handover certificate (printable copy for client).
- **P1** — Photo proof attachment in handover (currently only inspection).
- **P2** — Background email send via `BackgroundTasks` so submission isn't blocked when Resend is slow.
- **P2** — Sequential numbering for handovers (00453-style) instead of UUID hex.
- **P2** — Admin dashboard with weekly/monthly stats per site.
- **P2** — QR code generator for scaffold IDs.

## Next Tasks
1. User provides Resend API key → set `RESEND_API_KEY` in `/app/backend/.env`, restart backend.
2. Verify a live email delivery with a test handover.
3. Decide P1 priority next (PDF vs photo).
