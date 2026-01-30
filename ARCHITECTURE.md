# System Architecture

## 1. System Design

### 1.1 Overview
The **iTEKAD Mentor Reporting System** is a web-based application built to streamline the monitoring and reporting of mentorship programs (Bangkit & Maju). It employs a **hybrid architecture** that bridges legacy Google Workspace workflows with modern database capabilities.

### 1.2 Tech Stack
- **Frontend Framework:** Next.js 13+ (React)
    - Uses Pages Directory routing.
    - Styling: Tailwind CSS.
    - Visualization: Recharts (for GrowthWheel & Analytics).
- **Backend:** Next.js API Routes (Serverless Functions)
    - Handles form submissions, authentication callbacks, and data processing.
- **Authentication:** `next-auth`
    - Provider: Google OAuth 2.0.
    - Strategy: JWT-based sessions.
    - Authorization: Email allowlist for Admin access; Email mapping for Mentor access.

## 2. Data Architecture

### 2.1 Hybrid Storage Strategy (Dual-Write)
The system writes data to **two sources of truth** simultaneously to ensure business continuity while enabling advanced features.

| Feature | Google Sheets (Legacy/Primary) | Supabase PostgreSQL (Modern) |
| :--- | :--- | :--- |
| **Role** | Reporting Engine Source | Application Database |
| **Usage** | Used by App Script to generate PDF Reports | Used for Querying, Dashboard, & Relational Data |
| **Access** | `googleapis` (Node.js) | `@supabase/supabase-js` |
| **Latency** | High (~2-10s) | Low (~100-500ms) |

### 2.2 Core Entities (Supabase)
- **`mentors`**: System users (mentors & admins).
- **`entrepreneurs`**: Beneficiaries of the program.
- **`reports`**: Session reports for Bangkit program (`/laporan-bangkit`).
- **`upward_mobility_reports`**: Structured UM data (`/laporan-maju-um`, `/upward-mobility`).
- **`dual_write_monitoring`**: Audit log tracks success/failure of the sync process.

### 2.3 Data Flow
1.  **Submission**: User submits form via Frontend.
2.  **API Handler**: `pages/api/submitBangkit.js` (or similar) receives payload.
3.  **Validation**: Server-side validation checks required fields.
4.  **Google Drive Upload**: Images are uploaded to `api/upload-image`.
5.  **Dual-Write**:
    *   **Write A**: Append row to Google Sheet (Primary for PDFs).
    *   **Write B**: Insert record to Supabase `reports` table.
6.  **Response**: Success message returned to UI.

## 3. Integrations

### 3.1 Google Workspace
- **Google Sheets**: Acts as a database for legacy compatibility.
- **Google Drive**: Host for images and generated PDF reports.
- **Apps Script**: Triggers PDF generation based on Sheet updates.

### 3.2 Authentication (NextAuth)
- **Google Provider**: Users log in with Gmail.
- **Session**: Securely stores user email in encrypted JWT.
- **Middleware**: Protects routes based on session state.

## 4. Background Synchronization
Located in `scripts/`, these Node.js scripts handle data consistency:

- `sync-mappings.js`: Syncs Mentor-Mentee mapping from Sheets to Supabase.
- `sync-bangkit-reports.js`: Backfills Bangkit reports from Sheets to Supabase.
- `sync-maju-reports.js`: Backfills Maju reports from Sheets to Supabase.
- `sync-docurl.js`: Scrapes PDF URLs from Sheets and updates Supabase records.
