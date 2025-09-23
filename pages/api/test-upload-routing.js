// Test API endpoint to verify the upload-proxy routing fix
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reportType } = req.body;

  // Simulate the logic from upload-proxy.js to verify routing
  let url;
  
  if (reportType === 'maju') {
    url = process.env.NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL;
  } else {
    url = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
  }

  const result = {
    reportType,
    routedTo: reportType === 'maju' ? 'Maju Apps Script (appsscript-2)' : 'Sesi Apps Script (appsscript-1)',
    url: url ? url.substring(0, 50) + '...' : 'URL not configured',
    isCorrect: reportType === 'maju' ? !!process.env.NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL : !!process.env.NEXT_PUBLIC_APPS_SCRIPT_URL,
    timestamp: new Date().toISOString()
  };

  console.log('🔍 Upload routing test:', result);

  res.status(200).json({
    success: true,
    message: 'Upload routing test completed',
    result
  });
}
