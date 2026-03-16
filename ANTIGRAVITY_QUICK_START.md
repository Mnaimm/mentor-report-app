# Antigravity Google Sheets - Quick Start

## TL;DR - Get Started in 5 Minutes

### Step 1: Install MCP Server
```bash
pip install uvx
```

### Step 2: Get Your Base64 Credentials

You already have this in your `.env` file as `GOOGLE_CREDENTIALS_BASE64`!

**Windows PowerShell:**
```powershell
Get-Content .env | Select-String "GOOGLE_CREDENTIALS_BASE64"
```

**Command Prompt:**
```cmd
findstr "GOOGLE_CREDENTIALS_BASE64" .env
```

Copy the value (everything after the `=`)

### Step 3: Edit Antigravity Config

**Location:** `C:\Users\MyLenovo\.gemini\antigravity\mcp_config.json`

**Or via UI:** Antigravity → **...** menu → **MCP Servers** → **Manage MCP Servers** → **View raw config**

**Add this:**
```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "uvx",
      "args": ["mcp-google-sheets@latest"],
      "env": {
        "CREDENTIALS_CONFIG": "PASTE_YOUR_BASE64_HERE"
      }
    }
  }
}
```

### Step 4: Restart Antigravity

Close and reopen completely.

### Step 5: Test It!

In Antigravity, ask:
```
List all spreadsheets I have access to
```

Or:
```
Get the first 10 rows from the 'mapping' sheet in
spreadsheet ID: <paste GOOGLE_SHEETS_MAPPING_ID>
```

---

## Your Spreadsheet IDs

From your `.env` file, you have these sheets:

```bash
# Bangkit Reports
GOOGLE_SHEETS_REPORT_ID=your_id_here

# Maju Reports
GOOGLE_SHEETS_MAJU_REPORT_ID=your_id_here

# Mapping Data
GOOGLE_SHEETS_MAPPING_ID=your_id_here

# UM Data
GOOGLE_SHEET_ID_UM=1mO4Vn24QxbCO87iTKCVJn7E98ew5fxb7mTn_Yh6L2KI
```

---

## Available MCP Tools

Once configured, Antigravity can use these tools:

| Tool | What It Does |
|------|--------------|
| `list_spreadsheets` | List all accessible spreadsheets |
| `get_sheet_data` | Read data from a range (e.g., A1:Z100) |
| `create_spreadsheet` | Create new spreadsheet |
| `update_cells` | Write data to cells |
| `batch_update_cells` | Update multiple ranges at once |
| `add_rows` | Insert new rows |
| `add_columns` | Insert new columns |
| `list_sheets` | List all tabs in a spreadsheet |
| `create_sheet` | Add new tab to spreadsheet |
| `share_spreadsheet` | Grant access to users |
| `copy_sheet` | Duplicate sheets |
| `rename_sheet` | Rename tabs |

---

## Example Queries for Antigravity

**Explore your mapping data:**
```
Read all data from the 'mapping' tab in spreadsheet
<GOOGLE_SHEETS_MAPPING_ID> and show me the first 5 mentors
```

**Analyze Bangkit sessions:**
```
Get data from the 'Bangkit' sheet in <GOOGLE_SHEETS_REPORT_ID>,
filter for sessions with status "Completed", and count how many
sessions each mentor has completed
```

**Check MIA status:**
```
Read the 'LaporanMajuUM' tab from <GOOGLE_SHEETS_MAJU_REPORT_ID>
and show me all mentees with MIA_STATUS = "MIA"
```

**Create a summary:**
```
Read the 'batch' sheet from <GOOGLE_SHEETS_MAPPING_ID>,
analyze the current mentoring round periods, and create
a new spreadsheet with a summary table
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "uvx not found" | Run `pip install uvx` |
| "Permission denied" | Share the sheet with your service account email |
| "API not enabled" | Enable Sheets & Drive APIs in Google Cloud Console |
| Config not working | Validate JSON syntax, restart Antigravity |
| Server not showing | Check `~/.gemini/antigravity/logs/` for errors |

---

## What Can You Do?

### Data Analysis
- "Show me completion rates by batch"
- "Which mentors have the most MIA mentees?"
- "Calculate average sessions per mentor"

### Reporting
- "Create a weekly summary of completed sessions"
- "Generate a CSV of all active mentees"
- "Build a pivot table of sales by month"

### Automation
- "Find mentees with no sessions this month and list them"
- "Compare Bangkit vs Maju completion rates"
- "Identify sheets that need data cleanup"

### Development
- "Help me design a new sheet structure for tracking X"
- "Test this query before I code it in Next.js"
- "Prototype a new dashboard feature"

---

## Security Reminder

✅ DO:
- Keep credentials in `.env` (already gitignored)
- Use Base64 encoding for credentials
- Limit service account access to specific sheets

❌ DON'T:
- Commit `mcp_config.json` with credentials to git
- Share your Base64 credentials publicly
- Give service account more permissions than needed

---

## Next Steps

1. ✅ Set up MCP (you're doing this now!)
2. Test basic queries in Antigravity
3. Explore your existing data
4. Build new features using Antigravity
5. Port successful prototypes to your Next.js app

---

**Need detailed setup?** → See `ANTIGRAVITY_SHEETS_SETUP.md`

**Need config examples?** → See `antigravity-mcp-config-examples.json`
