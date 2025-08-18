// pages/api/upload-proxy.js - DEBUG VERSION
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Upload proxy called');
    console.log('📋 Request body keys:', Object.keys(req.body || {}));
    
    const { fileData, fileName, fileType, folderId, menteeName, sessionNumber } = req.body;

    // Check environment variable
    const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    console.log('🔑 Apps Script URL exists:', !!appsScriptUrl);
    
    if (!appsScriptUrl) {
      return res.status(500).json({ 
        error: 'NEXT_PUBLIC_APPS_SCRIPT_URL environment variable not set' 
      });
    }

    // Validate required fields
    if (!fileData) {
      return res.status(400).json({ error: 'fileData is required' });
    }
    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }
    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    console.log('📤 Calling Apps Script with:', {
      fileName,
      fileType,
      folderId,
      menteeName,
      sessionNumber,
      fileDataLength: fileData?.length || 0
    });

    // Call your Google Apps Script from the server (no CORS issues)
    const response = await fetch(appsScriptUrl, {
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

    console.log('📥 Apps Script response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Apps Script returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Apps Script result:', result);

    if (result.status === 'error') {
      throw new Error(result.message || 'Upload failed');
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Upload proxy error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      details: error.message,
      stack: error.stack
    });
  }
}