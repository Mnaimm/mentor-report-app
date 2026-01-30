# API Documentation

## 1. Submission Endpoints
These endpoints handle form data submission, image handling, and dual-write operations.

### `POST /api/submitBangkit`
Handles submission of Bangkit Session Reports.
- **Auth Required**: Yes
- **Body**: JSON payload including session details, initiatives, and image URLs.
- **Actions**:
  1. Appends row to "Bangkit" Google Sheet.
  2. Inserts record into `reports` Supabase table.
  3. Inserts record into `upward_mobility_reports` table (if data present).

### `POST /api/submitMajuReportum`
Handles submission of Maju Session Reports.
- **Auth Required**: Yes
- **Body**: JSON payload with advanced financial metrics and mentoring findings.
- **Actions**:
  1. Appends row to "LaporanMajuUM" Google Sheet.
  2. Inserts record into Supabase (Maju-specific tables).

### `POST /api/submit-upward-mobility`
Handles standalone Upward Mobility assessment.
- **Auth Required**: Yes
- **Body**: JSON payload for UM Sections 3-6.
- **Actions**:
  1. Updates Supabase `upward_mobility_reports`.

### `POST /api/upload-image`
Handles file uploads to Google Drive.
- **Auth Required**: Yes
- **Body**: `FormData` containing `file` and `folderId`.
- **Response**: `{ "url": "https://drive.google.com/..." }`

## 2. Data Retrieval Endpoints

### `GET /api/mapping`
Retrieves Mentor-Mentee assignments.
- **Query Params**:
  - `programType`: `bangkit` | `maju`
- **Source**: "Mapping" Google Sheet (cached).

### `GET /api/menteeData`
Retrieves historical data for a specific mentee.
- **Query Params**:
  - `name`: Mentee Name
- **Returns**: Previous session data, initiative history, and profile info.

### `GET /api/laporanMajuData`
Retrieves specific historical data for Maju program mentees including previous financial records and action plans.

## 3. Analytics & Admin Endpoints

### `GET /api/mentor-stats`
Retrieves statistics for the logged-in mentor.
- **Returns**:
  - Submission counts
  - Pending reports
  - MIA mentee list

### `GET /api/admin/sales-status`
Admin-only endpoint for system-wide sales tracking.
- **Auth Required**: Yes (Admin Email Allowlist)
- **Returns**: Aggregated sales data across all mentees.

## 4. Utility Endpoints

- **`/api/frameworkBank`**: Returns drop-down options for standardized forms.
- **`/api/test-env`**: Debug endpoint to verify environment variables (Admin only).
