# Supabase Schema Summary

**Generated:** February 1, 2026
**Database:** https://oogrwqxlwyoswyfqgxxi.supabase.co
**Tables Requested:** mentors, assignments, batch_rounds

---

## ✅ Table: `mentors` (27 records)

Complete schema with sample data:

| Column | Type | Nullable | Sample Value | Description |
|--------|------|----------|--------------|-------------|
| `id` | uuid | No | `66070375-a395-4bf2-86b9-12d8a26ed263` | Primary key |
| `name` | text/string | Yes | `AWIL` | Mentor's name |
| `email` | text/string | Yes | `azwilabadi@gmail.com` | Unique email identifier |
| `phone` | text/string | Yes | `011-35499853` | Contact phone number |
| `region` | text/string | Yes | `NULL` | Geographic region (not currently used) |
| `program` | text/string | Yes | `NULL` | Associated program (not currently used) |
| `status` | text/string | Yes | `active` | Mentor status |
| `created_at` | timestamp | No | `2025-11-14T10:13:39.689778+00:00` | Record creation timestamp |
| `updated_at` | timestamp | No | `2025-11-15T00:26:11.179286+00:00` | Last update timestamp |

### Primary Key
- `id` (uuid)

### Indexes
- Primary key index on `id`

### Notes
- `email` should be unique for mentor identification
- `region` and `program` columns exist but are currently NULL for all records
- Timestamps include timezone information

---

## ✅ Table: `batch_rounds` (27 records)

Complete schema with sample data:

| Column | Type | Nullable | Sample Value | Description |
|--------|------|----------|--------------|-------------|
| `id` | uuid | No | `9f53e4e4-435f-4a6d-88db-c3ea5544576b` | Primary key |
| `batch_name` | text/string | Yes | `Batch 2 Bangkit` | Batch display name |
| `program` | text/string | Yes | `Bangkit` | Program type (Bangkit/Maju) |
| `round_number` | integer/number | Yes | `1` | Mentoring round (1-4) |
| `round_name` | text/string | Yes | `Mentoring 1` | Round display name |
| `period_label` | text/string | Yes | `Jun – Ogos` | Period description |
| `start_month` | date | Yes | `2024-06-01` | Period start date |
| `end_month` | date | Yes | `2024-08-31` | Period end date |
| `notes` | text/string | Yes | `Selesai` | Status/completion notes |
| `created_at` | timestamp | No | `2025-11-19T01:57:36.990296+00:00` | Record creation timestamp |
| `batch_id` | text/string | Yes | `NULL` | Batch identifier (not currently used) |

### Primary Key
- `id` (uuid)

### Indexes
- Primary key index on `id`
- Potential indexes on `program`, `batch_name` for performance

### Notes
- Tracks mentoring program batches and their rounds
- Each batch can have multiple rounds (typically 4 sessions)
- Date range defines the active period for the batch/round
- `batch_id` exists but is currently NULL

---

## ⚠️ Table: `assignments` - NOT FOUND

**Status:** Table does not exist in the database

The table `assignments` was not found in the public schema. However, several related tables exist:

### Related Tables Found (All Empty - 0 records):

1. **`entrepreneur_assignments`** - 0 records
2. **`mentor_entrepreneur_assignments`** - 0 records
3. **`entrepreneur_mentors`** - 0 records
4. **`mentor_mentees`** - 0 records
5. **`mentee_assignments`** - 0 records

### Recommendations:

1. **Clarify which assignment table you need:**
   - For mentor-to-entrepreneur assignments: likely `mentor_entrepreneur_assignments`
   - For entrepreneur assignments: likely `entrepreneur_assignments`
   - For mentee tracking: likely `mentor_mentees` or `mentee_assignments`

2. **These tables are empty**, so schema cannot be inferred from data

3. **To get their schemas**, run this SQL in Supabase SQL Editor:

```sql
-- Get schema for any table
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'entrepreneur_assignments'  -- Change table name as needed
ORDER BY ordinal_position;
```

4. **To see all public tables:**

```sql
SELECT
    table_name,
    (SELECT COUNT(*)
     FROM information_schema.columns c
     WHERE c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

---

## 📊 Additional Tables in Database

Based on the database-setup.sql file, these core tables should also exist:

### `entrepreneurs`
- Stores entrepreneur/mentee information
- Referenced by reports and assignments

### `reports`
- Stores session reports (Bangkit & Maju)
- Large table with 60+ columns
- Includes JSONB fields for complex data

### `upward_mobility_reports`
- Tracks economic mobility metrics
- Before/after comparisons
- Financial, employment, digital adoption data

### `dual_write_monitoring` / `dual_write_logs`
- Tracks synchronization between Google Sheets and Supabase
- Logs success/failure of dual-write operations

### `user_roles`
- RBAC (Role-Based Access Control)
- Maps emails to roles (admin, mentor, coordinator, etc.)

---

## 🔍 How to Get Full Schema Information

Since you mentioned "using supabase mcp", here are alternative approaches:

### Option 1: Supabase Dashboard (Easiest)
1. Go to https://supabase.com/dashboard
2. Navigate to your project: `oogrwqxlwyoswyfqgxxi`
3. Click **Table Editor** in left sidebar
4. Select the table you want to inspect
5. View columns, types, constraints in the UI

### Option 2: SQL Editor (Most Complete)
1. Go to **SQL Editor** in Supabase Dashboard
2. Run the queries provided above
3. Export results as JSON or CSV

### Option 3: Supabase CLI (Command Line)
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref oogrwqxlwyoswyfqgxxi

# Generate TypeScript types (includes full schema)
supabase gen types typescript --local > database.types.ts
```

### Option 4: Node.js Script with Direct SQL
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Query information_schema directly via SQL
const { data, error } = await supabase.rpc('exec', {
  query: `SELECT * FROM information_schema.columns WHERE table_name = 'mentors'`
});
```

---

## 🚀 Next Steps

1. **Clarify which assignment table you need**
   - Different tables serve different purposes
   - Confirm the exact table name required

2. **If tables are empty**, consider:
   - Are these tables actually being used?
   - Do you need to populate them?
   - Should assignment data come from elsewhere?

3. **For MCP integration**, you may want to:
   - Set up Google Antigravity MCP for Sheets access
   - Use Supabase REST API for direct queries
   - Create custom RPC functions for schema introspection

4. **Generate TypeScript types** for type safety:
   ```bash
   npx supabase gen types typescript --project-id oogrwqxlwyoswyfqgxxi > lib/database.types.ts
   ```

---

## 📝 Summary

| Table | Status | Records | Schema Available |
|-------|--------|---------|------------------|
| `mentors` | ✅ Exists | 27 | ✅ Complete |
| `batch_rounds` | ✅ Exists | 27 | ✅ Complete |
| `assignments` | ❌ Not Found | N/A | N/A |
| `entrepreneur_assignments` | ⚠️ Empty | 0 | ⚠️ Needs SQL query |
| `mentor_entrepreneur_assignments` | ⚠️ Empty | 0 | ⚠️ Needs SQL query |

**Recommendation:** Use the SQL queries provided above in Supabase Dashboard to get the full schema for empty tables, or clarify which specific assignment table you need.
