// pages/api/upload-proxy.js
// Revert to the working version that simply proxies to Apps Script

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const url = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL; // must be /exec
    if (!url) return res.status(500).json({ error: 'NEXT_PUBLIC_APPS_SCRIPT_URL not set' });

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },   // server→server is OK
      body: JSON.stringify(req.body),
    });

    const text = await upstream.text();                  // ← read text first

    try {
      const json = JSON.parse(text);                     // try JSON
      return res.status(upstream.ok ? 200 : 500).json(json);
    } catch {
      // Forward the raw body (likely HTML error or login page) to debug
      return res.status(upstream.status).send(text);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed', details: String(err) });
  }
}