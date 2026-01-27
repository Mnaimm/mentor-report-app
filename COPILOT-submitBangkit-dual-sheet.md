# submitBangkit – Dual Google Sheets Write (Bangkit + Upward Mobility)

## Context

This project uses **Next.js API routes** (Node.js + Google Sheets API).
Do NOT use Google Apps Script for data fan-out logic.

`laporan-bangkit.js` is a **combined form**:
- Session / Mentoring Report (formerly `laporan-sesi`)
- Upward Mobility (formerly standalone `upward-mobility.js`)

A **single submission** must write to **TWO Google Sheets concurrently**.

---

## Source of Truth

The API endpoint is:

/pages/api/submitBangkit.js


All Google Sheets writes MUST happen here.

Apps Script is used ONLY for:
- document generation
- time-based automation

Apps Script must NOT:
- append rows
- duplicate Upward Mobility data
- orchestrate multi-sheet writes

---

## Required Behavior

When `laporan-bangkit.js` submits:

### 1️⃣ Write to Bangkit Sheet (already implemented)

- Spreadsheet ID: `GOOGLE_SHEETS_REPORT_ID`
- Sheet name: `Bangkit`
- Columns:
  - Session data
  - Initiatives
  - Sales
  - Reflections
  - UM snapshot (BC–CB)

⚠️ This logic already exists and MUST NOT be broken.

---

### 2️⃣ Write to Upward Mobility Sheet (NEW – REQUIRED)

- Spreadsheet ID:
1mO4Vn24QxbCO87iTKCVJn7E98ew5fxb7mTn_Yh6L2KI


- Sheet name:
Upward Mobility


This sheet previously received data from:
pages/upward-mobility.js


Now it must ALSO receive data from `submitBangkit`.

---

## Column Rules (Backward Compatible)

The Upward Mobility sheet has columns **A → BT**.

For `submitBangkit`, ONLY populate:

### ✅ Columns A → K
| Column | Field |
|------|------|
| A | Timestamp |
| B | Email Address |
| C | Program |
| D | Batch |
| E | Sesi Mentoring |
| F | Nama Mentor |
| G | Nama Penuh Usahawan |
| H | Nama Perniagaan |
| I | Jenis Perniagaan / Produk |
| J | Alamat Perniagaan |
| K | Nombor Telefon |

### ✅ Columns AB → BT (UM fields ONLY)

Populate these using parsed `UPWARD_MOBILITY_JSON`:

- UM_STATUS_PENGLIBATAN
- UM_STATUS
- UM_KRITERIA_IMPROVEMENT
- UM_AKAUN_BIMB
- UM_BIMB_BIZ
- UM_AL_AWFAR
- UM_MERCHANT_TERMINAL
- UM_FASILITI_LAIN
- UM_MESINKIRA
- UM_PENDAPATAN_SEMASA
- UM_ULASAN_PENDAPATAN
- UM_PEKERJA_SEMASA
- UM_ULASAN_PEKERJA
- UM_ASET_BUKAN_TUNAI_SEMASA
- UM_ULASAN_ASET_BUKAN_TUNAI
- UM_ASET_TUNAI_SEMASA
- UM_ULASAN_ASET_TUNAI
- UM_SIMPANAN_SEMASA
- UM_ULASAN_SIMPANAN
- UM_ZAKAT_SEMASA
- UM_ULASAN_ZAKAT
- UM_DIGITAL_SEMASA
- UM_ULASAN_DIGITAL
- UM_MARKETING_SEMASA
- UM_ULASAN_MARKETING
- UM_TARIKH_LAWATAN_PREMIS

🚫 Columns L → AA MUST remain untouched  
(legacy fields from standalone UM form).

---

## Implementation Rules

- Use **Google Sheets API** (`googleapis`)
- Use the **same auth** already configured in `submitBangkit`
- Perform the UM sheet write:
  - AFTER Bangkit sheet append succeeds
  - As **best-effort** (non-blocking)
- Failure to write UM sheet MUST NOT fail Bangkit submission

---

## Data Mapping Rules

- Parse UM data from:
```js
JSON.parse(reportData.UPWARD_MOBILITY_JSON)
Create a separate mapping function:

mapUMToUpwardMobilitySheetRow(reportData, umData)
The returned array MUST align with:

A–K populated

L–AA empty strings

AB–BT populated

Explicit Non-Goals (Do NOT Do This)
❌ Do NOT move logic to Apps Script

❌ Do NOT overwrite L–AA columns

❌ Do NOT create a new UM sheet

❌ Do NOT change existing Bangkit mapping

❌ Do NOT require a second form submission

Mental Model
laporan-bangkit.js
        ↓
submitBangkit.js
        ├─ Google Sheet: Bangkit
        └─ Google Sheet: Upward Mobility
One submission → two sheets → same source data.

Acceptance Criteria
Bangkit submission continues to work

UM sheet receives new rows

Legacy UM standalone form remains compatible

No Apps Script changes required