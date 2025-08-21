// pages/api/upload-proxy.js
// Updated to handle both laporan-sesi and laporan-maju URLs

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Determine which Apps Script URL to use based on reportType
    const reportType = req.body.reportType;
    let url;

    if (reportType === 'maju') {
      url = process.env.NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL;
      if (!url) return res.status(500).json({ error: 'NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL not set' });
      console.log('🎯 Using MAJU Apps Script URL for reportType:', reportType);
    } else {
      // Default to sesi URL for backward compatibility
      url = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
      if (!url) return res.status(500).json({ error: 'NEXT_PUBLIC_APPS_SCRIPT_URL not set' });
      console.log('🎯 Using SESI Apps Script URL for reportType:', reportType || 'default');
    }

    console.log('📡 Proxying to Apps Script URL:', url);

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const text = await upstream.text();

    try {
      const json = JSON.parse(text);
      console.log('✅ Successfully parsed JSON response');
      return res.status(upstream.ok ? 200 : 500).json(json);
    } catch {
      console.error('❌ Failed to parse Apps Script response as JSON:', text);
      // Forward the raw body (likely HTML error or login page) to debug
      return res.status(upstream.status).send(text);
    }
  } catch (err) {
    console.error('❌ Upload proxy error:', err);
    return res.status(500).json({ error: 'Upload failed', details: String(err) });
  }
}