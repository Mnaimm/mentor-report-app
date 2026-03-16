# Google Antigravity + MCP Google Sheets Setup Guide

This guide will help you enable Google Antigravity to fetch data from your Google Sheets using the MCP (Model Context Protocol) Google Sheets server.

## Overview

You'll be setting up the `mcp-google-sheets` MCP server to connect Google Antigravity with your existing Google Sheets. This will allow Antigravity to read and write to your sheets without writing API code.

---

## Prerequisites

1. **Google Antigravity** installed and running
2. **Google Cloud Project** with:
   - Google Sheets API enabled
   - Google Drive API enabled
3. **Python** and **uvx** installed (for running the MCP server)

---

## Part 1: Google Cloud Setup

### Step 1: Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Library**
4. Search for and enable:
   - **Google Sheets API**
   - **Google Drive API**

### Step 2: Choose Authentication Method

**Option A: Service Account (Recommended)**

This is the same method you're already using in your Next.js app!

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Enter name (e.g., "antigravity-sheets-access")
4. Click **Create and Continue**
5. Skip role assignment (optional)
6. Click **Done**
7. Click on the new service account
8. Go to **Keys** tab
9. Click **Add Key** > **Create New Key**
10. Choose **JSON** format
11. Click **Create** (file downloads automatically)

**IMPORTANT**: Save this JSON file securely. You'll reference it in the configuration.

### Step 3: Share Google Sheets with Service Account

For each spreadsheet you want Antigravity to access:

1. Open the Google Sheet
2. Click **Share**
3. Add the service account email (looks like: `antigravity-sheets-access@project-id.iam.gserviceaccount.com`)
4. Set permission to **Editor** (if you want write access) or **Viewer** (read-only)
5. Click **Send**

**Alternative**: Create a shared Google Drive folder and share it with the service account, then move all your sheets there.

---

## Part 2: Install MCP Google Sheets Server

### Step 1: Install uvx (if not already installed)

```bash
# Using pip
pip install uvx

# Or using pipx
pipx install uvx
```

### Step 2: Test the MCP Server

Run this command to verify it works:

```bash
uvx mcp-google-sheets@latest
```

You should see output indicating the server is running.

---

## Part 3: Configure Antigravity

### Step 1: Locate the Config File

**Windows:**
```
C:\Users\<YOUR_USERNAME>\.gemini\antigravity\mcp_config.json
```

**macOS/Linux:**
```
~/.gemini/antigravity/mcp_config.json
```

**Or via UI:**
1. Open Antigravity
2. Click the **"..."** menu (three dots) in the Agent panel
3. Select **"MCP Servers"**
4. Click **"Manage MCP Servers"**
5. Click **"View raw config"**

### Step 2: Add Google Sheets Configuration

**Method 1: Using Service Account (Simple)**

Add this to your `mcp_config.json`:

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "uvx",
      "args": ["mcp-google-sheets@latest"],
      "env": {
        "SERVICE_ACCOUNT_PATH": "C:\\Users\\MyLenovo\\path\\to\\service-account-key.json",
        "DRIVE_FOLDER_ID": "your_shared_folder_id_here_optional"
      }
    }
  }
}
```

**Important Notes:**
- Use **double backslashes** (`\\`) in Windows paths
- `DRIVE_FOLDER_ID` is optional - only needed if you're using a shared folder
- Get folder ID from the Drive URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

**Method 2: Using Base64 Credentials (Like Your Current Setup)**

Since you already have `GOOGLE_CREDENTIALS_BASE64` in your environment, you can reuse it:

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "uvx",
      "args": ["mcp-google-sheets@latest"],
      "env": {
        "CREDENTIALS_CONFIG": "YOUR_BASE64_ENCODED_CREDENTIALS_HERE"
      }
    }
  }
}
```

Replace `YOUR_BASE64_ENCODED_CREDENTIALS_HERE` with the actual Base64 string from your `.env` file.

**Method 3: Using Your Existing Credentials File**

If you have the JSON file on disk:

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "uvx",
      "args": ["mcp-google-sheets@latest"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\path\\to\\credentials.json"
      }
    }
  }
}
```

### Step 3: Restart Antigravity

Close and reopen Google Antigravity for the changes to take effect.

---

## Part 4: Verify Setup

### Test in Antigravity

1. Open Antigravity
2. Start a new conversation
3. Click the **MCP Servers** panel (right side)
4. You should see **google-sheets** listed with available tools:
   - `list_spreadsheets`
   - `create_spreadsheet`
   - `get_sheet_data`
   - `update_cells`
   - `batch_update_cells`
   - And more...

### Example Commands to Try

Ask Antigravity:
- "List all my spreadsheets"
- "Get data from sheet 'Bangkit' in spreadsheet ID: `YOUR_SHEET_ID`"
- "Create a new spreadsheet called 'Test Sheet'"
- "Read range A1:C10 from the 'mapping' tab in spreadsheet ID: `YOUR_SHEET_ID`"

---

## Part 5: Connect to Your Existing Sheets

Now you can have Antigravity access your existing mentor report sheets!

### Get Your Spreadsheet IDs

From your `.env` file:
- `GOOGLE_SHEETS_REPORT_ID` - Bangkit reports
- `GOOGLE_SHEETS_MAJU_REPORT_ID` - Maju reports
- `GOOGLE_SHEETS_MAPPING_ID` - Mapping data
- `GOOGLE_SHEET_ID_UM` - UM data

### Example Queries

**Read mapping data:**
```
Get all rows from the 'mapping' sheet in spreadsheet ID:
<paste GOOGLE_SHEETS_MAPPING_ID here>
```

**Read Bangkit sessions:**
```
Get data from range A1:Z1000 in the 'Bangkit' tab from spreadsheet ID:
<paste GOOGLE_SHEETS_REPORT_ID here>
```

**Create summary report:**
```
Read the 'batch' sheet from <SHEET_ID>, calculate how many mentors
are in each batch, and create a new spreadsheet with the summary
```

---

## Troubleshooting

### Error: "Permission denied"
- Make sure you've shared the spreadsheet with the service account email
- Or add the sheet to the shared Drive folder

### Error: "API not enabled"
- Go to Google Cloud Console and enable Google Sheets API and Drive API
- Wait a few minutes for changes to propagate

### Error: "Cannot find uvx"
- Install uvx: `pip install uvx`
- Or use full path in config: `"command": "C:\\Users\\MyLenovo\\AppData\\Local\\Programs\\Python\\Python3XX\\Scripts\\uvx.exe"`

### MCP Server Not Appearing
- Check JSON syntax in `mcp_config.json` (use a JSON validator)
- Restart Antigravity completely
- Check Antigravity logs for errors

### Rate Limits
- Google Sheets API has quotas (100 requests per 100 seconds per user)
- Keep total MCP tools under 50 for best performance

---

## Advanced: Hybrid Approach

You can use **both** your existing Next.js API (for production) and MCP (for Antigravity development):

**Use Next.js API for:**
- Production application
- Scheduled sync scripts
- High-frequency automated operations

**Use MCP + Antigravity for:**
- Interactive data exploration
- One-off data analysis
- Building new features quickly
- Testing queries before coding them

---

## Next Steps

Once setup is complete:

1. **Explore your data** - Ask Antigravity to analyze your sheets
2. **Build dashboards** - Create visual reports from your mentoring data
3. **Automate tasks** - Generate reports, summaries, or notifications
4. **Prototype features** - Test new functionality before coding it in Next.js

---

## Resources

- [MCP Google Sheets GitHub](https://github.com/xing5/mcp-google-sheets)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Antigravity MCP Documentation](https://antigravity.google/docs/mcp)
- Your existing code: `lib/sheets.js` and `scripts/lib/sheets-client.js`

---

## Security Notes

- **Never commit** the service account JSON file to git
- **Never share** your Base64 credentials publicly
- **Use environment variables** for sensitive data
- **Limit scope** - only share specific sheets with the service account
- **Monitor usage** - check Google Cloud Console for API usage

---

## Support

If you run into issues:
1. Check Antigravity logs (usually in `~/.gemini/antigravity/logs/`)
2. Verify JSON syntax in config file
3. Test credentials with a simple `gcloud` command
4. Check Google Cloud Console for API quotas and errors

---

**You're all set! Antigravity can now fetch and manipulate your Google Sheets data.**
