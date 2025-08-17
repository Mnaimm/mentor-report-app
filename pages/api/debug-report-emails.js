import { google } from "googleapis";

const REPORT_SHEET_ID = process.env.GOOGLE_SHEETS_REPORT_ID;
const REPORT_TAB      = process.env.REPORT_TAB || "V8";

async function getSheets() {
  const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  const credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

export default async function handler(req, res) {
  try {
    const sheets = await getSheets();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: REPORT_SHEET_ID,
      range: `${REPORT_TAB}!A:ZZ`,
    });
    const rows = data.values || [];
    const headers = rows[0] || [];
    const body = rows.slice(1);

    const emailIdx = headers.findIndex(h => (h || "").toString().toLowerCase().trim().startsWith("email"));
    const counts = {};
    if (emailIdx > -1) {
      for (const r of body) {
        const em = (r[emailIdx] || "").toLowerCase().trim();
        if (!em) continue;
        counts[em] = (counts[em] || 0) + 1;
      }
    }
    res.json({ reportTab: REPORT_TAB, emailColumnIndex: emailIdx, counts });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
