# iTEKAD Mentor Portal — Project Context for Gemini CLI

## What This Project Is

A web-based mentor management portal for **Startlah Innovation's iTEKAD program**, managing mentorship sessions, laporan (report) submissions, entrepreneur assignments, and admin workflows across multiple program batches and Malaysian regions.

Built and maintained by a solo vibe coder using AI coding tools.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | NextAuth.js — Google OAuth with RBAC |
| Deployment | Vercel |
| Email | Resend |
| Legacy / PDF | Google Sheets + Apps Script |
| Styling | Tailwind CSS |

---

## Critical Architecture Rules

1. **Always use `createAdminClient()`** with the service role key for all server-side Supabase queries. Never use the anon client on the server.
2. **Supabase is the single source of truth** for all data. Google Sheets is legacy/PDF generation only.
3. **Active laporan forms are `laporan-bangkit.js` and `laporan-maju-um.js` ONLY.** All other forms (`laporan-sesi.js`, `laporan-maju.js`, etc.) are retired — do not modify or reference them.
4. **Two-tool-call constraint for write operations:** 1 script build + 1 MCP/SQL execute. No multi-step write chains.
5. **Google Sheets is read-only legacy.** Never write back to Sheets from new features.

---

## Supabase Project

- **Project ID:** `oogrwqxlwyoswyfqgxxi`
- **Environment vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `RESEND_API_KEY`

---

## Key Database Tables

```
mentors               — mentor profiles, linked to Google OAuth email
entrepreneurs         — usahawan records, linked to program batches
mentor_assignments    — many-to-many: mentor ↔ entrepreneur per batch_round
batch_rounds          — program batch definitions (Bangkit / Maju / TUBF)
laporan_bangkit       — session reports for Bangkit program
laporan_maju_um       — session + UM reports for Maju program
mia_records           — Missing In Action escalation records
mia_proofs            — evidence attachments for MIA (WhatsApp/email/call)
audit_log             — admin action history
```

### Known Schema Quirks

- `batch_rounds` has orphan rows with `NULL` program — always guard joins with `WHERE batch_name IS NOT NULL`
- Some older rows use `start_date`/`end_date`; active rows use `start_month`/`end_month`
- Column naming inconsistency exists: `nama_usahawan` vs `nama_mentee` — check per table
- Always apply `UPPER()` normalization when matching program/batch name strings

---

## Active Programs

| Program | Current Batch |
|---|---|
| Bangkit | Batch 8 |
| Maju | Batch 7 (Maju-UM) |
| TUBF | Ongoing |

---

## Key Pages & API Routes

```
/pages/laporan-bangkit.js       — Active Bangkit report form (supports URL query param prefill)
/pages/laporan-maju-um.js       — Active Maju-UM report form (supports URL query param prefill)
/pages/usahawan-saya.js         — Mentor's entrepreneur list (Supabase-only, email→mentors.id)
/pages/admin/mia.js             — Admin MIA dashboard
/pages/api/send-reminder.js     — Manually triggered email reminders via Resend
/pages/api/reassign-mentor.js   — Admin mentor reassignment (uses createAdminClient)
/lib/supabase.js                — createAdminClient() and createClient() helpers
/lib/sheets.js                  — Legacy Google Sheets client (do not extend)
```

---

## Known Active Bugs / In-Progress Work

- `submitMajuReport.js` — broken, missing Supabase import (do not use)
- `lib/sheets.js` — hardcodes wrong spreadsheet ID (legacy, do not fix unless explicitly asked)
- Maju revision sync incorrectly targets Bangkit tab — scoped but not yet fixed
- `audit_log.changed_by` records `null` for some admin actions — under investigation
- Logging is split across two tables — consolidation planned but not started

---

## Email Reminder Feature (In Planning)

- Trigger: Admin clicks "Send Reminder Emails" button
- Delivery: Resend API, one consolidated email per mentor
- Content: List of all pending laporan submissions grouped by deadline
- Prerequisite: Confirm `laporan-bangkit.js` and `laporan-maju-um.js` support URL query param prefill before linking deep URLs in emails

---

## Coding Conventions

- All new API routes go in `/pages/api/` (Pages Router pattern — do not mix with App Router)
- Server components use `createAdminClient()` from `lib/supabase.js`
- Client components use standard `supabase-js` anon client only for auth state
- Error responses follow `{ error: "message" }` JSON pattern
- Console logs use `[feature-name]` prefix for traceability (e.g. `[send-reminder]`)

---

## What NOT To Do

- Do not create new Google Sheets integrations
- Do not modify retired laporan forms
- Do not use anon Supabase client on the server
- Do not write multi-step DB migrations without explicit confirmation
- Do not assume `batch_rounds` rows are clean — always validate nulls

---

## Helpful Context

- Developer is a solo vibe coder — prefer clear, well-commented code
- Explain any non-obvious decisions inline as comments
- When suggesting DB changes, provide the SQL and ask for confirmation before applying
- This portal serves ~16–25 mentors and 95–200+ entrepreneurs across Malaysian regions
