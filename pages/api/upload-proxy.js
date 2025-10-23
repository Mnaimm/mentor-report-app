// pages/api/upload-proxy.js
// Updated to handle both laporan-sesi and laporan-maju URLs with size limits

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Check request size (approximate check using Content-Length header)
    const contentLength = req.headers['content-length'];
    const maxSize = 900 * 1024; // 900KB to stay under 1MB limit with some buffer
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      console.error('🚫 Request too large:', contentLength, 'bytes (max:', maxSize, ')');
      return res.status(413).json({ 
        error: 'Request too large', 
        message: 'File size exceeds 900KB limit. Please compress images or reduce file sizes.',
        maxSize: '900KB'
      });
    }

    // Additional check on the actual body
    const bodyString = JSON.stringify(req.body);
    const bodySizeBytes = Buffer.byteLength(bodyString, 'utf8');
    
    if (bodySizeBytes > maxSize) {
      console.error('🚫 Body too large:', bodySizeBytes, 'bytes (max:', maxSize, ')');
      return res.status(413).json({ 
        error: 'Request body too large', 
        message: 'Data size exceeds 900KB limit. Please compress images or reduce file sizes.',
        actualSize: `${Math.round(bodySizeBytes / 1024)}KB`,
        maxSize: '900KB'
      });
    }

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
    console.log('📊 Request body size:', Math.round(bodySizeBytes / 1024), 'KB');

    // Clean the request body - remove proxy-specific fields before forwarding
    const cleanBody = { ...req.body };
    delete cleanBody.reportType; // This is only for routing, not for Apps Script
    delete cleanBody.imageType;  // This is only for logging, not for Apps Script

    // IMPORTANT: Add 'action: uploadImage' for Apps Script routing
    cleanBody.action = 'uploadImage';

    console.log('📤 Sending to Apps Script with action:', cleanBody.action);

    const cleanBodyString = JSON.stringify(cleanBody);
    const cleanBodySize = Buffer.byteLength(cleanBodyString, 'utf8');
    
    console.log('🧹 Cleaned body size:', Math.round(cleanBodySize / 1024), 'KB');

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': cleanBodySize.toString()
      },
      body: cleanBodyString,
    });

    const text = await upstream.text();

    try {
      const json = JSON.parse(text);
      console.log('✅ Successfully parsed JSON response');
      return res.status(upstream.ok ? 200 : 500).json(json);
    } catch (parseError) {
      console.error('❌ Failed to parse Apps Script response as JSON:', text.substring(0, 200), '...');
      
      // Check if it's a size limit error from the upstream service
      if (text.toLowerCase().includes('body') && text.toLowerCase().includes('limit')) {
        return res.status(413).json({ 
          error: 'Request too large for upstream service',
          message: 'The data is too large for the Google Apps Script endpoint. Please compress images or reduce file sizes.'
        });
      }
      
      // Forward the raw body (likely HTML error or login page) to debug
      return res.status(upstream.status).send(text);
    }
  } catch (err) {
    console.error('❌ Upload proxy error:', err);
    
    // Check if it's a body size error
    if (err.message && err.message.includes('body') && err.message.includes('limit')) {
      return res.status(413).json({ 
        error: 'Request too large', 
        message: 'File size exceeds server limits. Please compress images or reduce file sizes.',
        details: 'Maximum request size is 1MB'
      });
    }
    
    return res.status(500).json({ error: 'Upload failed', details: String(err) });
  }
}