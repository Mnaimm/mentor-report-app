# AI Agent Instructions
Project: iTEKAD Mentor Reporting System

Purpose:
This file provides context and operational rules for AI coding agents (Codex, Claude Code, Copilot) working on this repository.

The goal is to help AI understand the architecture, avoid breaking legacy workflows, and implement changes safely.

---

# 1. Project Overview

The **iTEKAD Mentor Portal** is a web application used to manage mentorship programs for Malaysian entrepreneurs.

Programs supported:
- iTEKAD Bangkit (entry level entrepreneurship)
- iTEKAD Maju (advanced growth program)

The system allows:
- Mentors to submit session reports
- Admins to monitor mentor performance
- Coordinators to track entrepreneur progress

Stakeholders:
- 100+ volunteer mentors
- ~400 entrepreneurs
- Program coordinators
- Payment administrators
- System administrators

---

# 2. Technology Stack

Frontend
- Next.js 13 (Pages Router)
- React
- Tailwind CSS
- SWR for data fetching
- Recharts for visualization

Backend
- Next.js API Routes (serverless functions)
- Supabase PostgreSQL

Authentication
- NextAuth.js
- Google OAuth

Integrations
- Google Sheets (legacy reporting engine)
- Google Drive (image + PDF storage)
- Google Apps Script (PDF generation)

Deployment
- Vercel

---

# 3. System Architecture

The system uses a **hybrid dual-write architecture**.

Purpose:
Maintain legacy Google Sheets workflows while introducing a modern database.

Storage layers:

Google Sheets
Role:
Legacy reporting system and PDF generator.

Supabase PostgreSQL
Role:
Primary application database for queries, dashboards and relational data.

Latency comparison:
Sheets: ~2–10 seconds
Supabase: ~100–500 ms

---

# 4. CRITICAL RULE: Dual Write Architecture

All report submissions must follow this pattern.

Step 1 (PRIMARY)
Write to Google Sheets.

Step 2 (SECONDARY)
Write to Supabase.

Supabase failures must NOT block the user response.

Example pattern:


try {
await appendToGoogleSheet(data)
} catch (error) {
return error
}

try {
await supabase.insert(...)
} catch (error) {
logDualWriteFailure(...)
}


If Google Sheets fails:
→ the API must return an error.

If Supabase fails:
→ log the error but allow submission to succeed.

All failures must be recorded in:

dual_write_monitoring table.

---

# 5. Core Database Tables

mentor_mentee_mapping
Maps mentors to entrepreneurs.

reports
Session reports for Bangkit and Maju programs.

upward_mobility_reports
UM assessment data.

user_roles
Role based access control.

dual_write_monitoring
Tracks success or failure of Supabase sync operations.

---

# 6. Key Application Files

Frontend pages

pages/index.js
Mentor dashboard

pages/laporan-bangkit.js
Bangkit session report form

pages/laporan-maju-um.js
Maju report form

pages/growthwheel.js
GrowthWheel assessment

Admin pages

pages/admin/index.js
System admin dashboard

pages/coordinator/dashboard.js
Coordinator view

API Routes

pages/api/submitReport.js
Bangkit submission handler

pages/api/submitMajuReport.js
Maju submission handler

pages/api/getMentorReports.js
Fetch mentor reports

pages/api/mapping.js
Mentor-mentee mapping

pages/api/uploadImage.js
Google Drive uploads

Library utilities

lib/auth.js
Role-based authorization

lib/supabaseClient.js
Supabase client

lib/googleSheets.js
Google Sheets API wrapper

---

# 7. Report Workflow

Session 1
Baseline business profile.

Includes:
- GrowthWheel 360 assessment
- 12 month sales history
- 4 initiatives
- business profile data

Sessions 2–4
Progress tracking.

Includes:
- updates to initiatives
- updated sales
- progress photos
- optional upward mobility assessment

---

# 8. MIA Workflow

If mentee cannot be contacted:

Mentor selects status = MIA.

Required fields:
- reason
- proof of contact attempt

Images must be saved to:

Mentor_{mentor}/MIA_Images/

Do not mix with session images.

---

# 9. Role Based Access

Roles in system:

mentor
Submit reports and view own dashboard.

program_coordinator
Manage mentor assignments.

report_admin
Report administration.

payment_admin
Handles mentor payment.

system_admin
Full access.

stakeholder
Read-only dashboard.

---

# 10. Background Sync Scripts

Located in:

scripts/

Purpose:
Backfill and synchronize Google Sheets data into Supabase.

Key scripts:

sync-mappings.js
Sync mentor-mentee assignments.

sync-bangkit-reports.js
Backfill Bangkit reports.

sync-maju-reports.js
Backfill Maju reports.

sync-docurl.js
Update Supabase records with PDF URLs.

These scripts ensure Supabase remains consistent with legacy Sheets.

---

# 11. Migration Scripts

A dedicated migration toolkit exists for large imports (~1000 records).

Execution flow:

1 sync batches
2 sync mentor mapping
3 sync entrepreneurs
4 sync bangkit reports
5 sync maju reports
6 sync upward mobility reports

Always run scripts in this order.

Safety mechanisms:

DRY_RUN mode
Duplicate detection
Progress logging
Error JSON logs

---

# 12. Development Rules

AI agents must follow these rules.

Never query Google Sheets for dashboards.

All reads must use Supabase.

Always maintain dual-write structure.

Never use spreadsheet row numbers as IDs.

Always validate required fields in API routes.

Log all dual-write failures.

When modifying report schema:
- update form
- update API handler
- update Supabase schema
- update sync scripts if needed

---

# 13. Debugging Workflow

When report submission fails check in this order:

1 Authentication
NextAuth session

2 Authorization
user_roles table

3 Form validation

4 Google Sheets access

5 Supabase connection

6 Google Drive upload

7 dual_write_monitoring logs

---

# 14. Development Philosophy

This project uses **AI assisted development**.

AI tools:
- Claude Code
- OpenAI Codex
- GitHub Copilot

AI should assist with:
- boilerplate generation
- code refactoring
- debugging
- documentation

Human responsibility:
- business logic
- architecture decisions
- data integrity
- UX design

---

# 15. Critical Safety Rules

Never break Google Sheets integration until PDF generation is migrated.

Never block user submission because Supabase fails.

Always log sync failures.

Always test both programs after changes:

Bangkit workflow
Maju workflow

Also test MIA submissions.

---

# 16. Key Principle

This system supports real mentorship programs.

Data integrity is critical.

Prefer:
- safe changes
- strong validation
- verbose logging

over clever optimizations.