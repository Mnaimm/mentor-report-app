// pages/api/upload-proxy.js
// Updated to handle both laporan-sesi and laporan-maju URLs with size limits

import https from 'https';
import { URL } from 'url';

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

    // Use native Node.js https module instead of fetch to avoid undici DNS issues
    const makeHttpsRequest = (url, body) => {
      return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          },
          timeout: 30000 // 30 second timeout
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              text: () => Promise.resolve(data)
            });
          });
        });

        req.on('error', (err) => {
          console.error('❌ HTTPS request error:', err.code, err.message);
          reject(err);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout after 30 seconds'));
        });

        req.write(body);
        req.end();
      });
    };

    // Retry logic for network/DNS issues
    let upstream;
    let lastError;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${maxRetries} connecting to Apps Script...`);

        upstream = await makeHttpsRequest(url, cleanBodyString);

        console.log(`✅ Connection successful on attempt ${attempt}`);
        break; // Success - exit retry loop

      } catch (fetchError) {
        lastError = fetchError;
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, fetchError.message);

        // Check for DNS/network errors
        if (fetchError.code === 'ENOTFOUND') {
          console.error('   🔍 DNS Resolution Failed - Cannot find script.google.com');
          console.error('   💡 Possible causes:');
          console.error('      1. No internet connection');
          console.error('      2. DNS server not responding');
          console.error('      3. Firewall/Antivirus blocking Node.js');
          console.error('      4. VPN/Proxy issues');
        }

        // If not the last attempt, wait and retry
        if (attempt < maxRetries) {
          console.log(`   ⏳ Waiting ${retryDelay/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // Last attempt failed - throw the error
          throw lastError;
        }
      }
    }

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