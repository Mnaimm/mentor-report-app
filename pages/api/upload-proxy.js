// pages/api/upload-proxy.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileData, fileName, fileType, folderId, menteeName, sessionNumber } = req.body;

    // Call your Google Apps Script from the server (no CORS issues)
    const response = await fetch(process.env.NEXT_PUBLIC_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileData,
        fileName,
        fileType,
        folderId,
        menteeName,
        sessionNumber
      })
    });

    const result = await response.json();

    if (result.status === 'error') {
      throw new Error(result.message || 'Upload failed');
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('Upload proxy error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      details: error.message 
    });
  }
}