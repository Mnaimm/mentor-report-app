// pages/api/upload-image.js
import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs';

// Disable bodyParser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  console.log('🔍 Upload-image API called with method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const form = new IncomingForm();

  try {
    console.log('📝 Parsing form data...');
    const [fields, files] = await form.parse(req);
    
    console.log('📋 Fields received:', Object.keys(fields));
    console.log('📁 Files received:', Object.keys(files));
    console.log('🆔 Folder ID from fields:', fields.folderId);
    
    const uploadedFile = files.file?.[0];
    
    if (!uploadedFile) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    console.log('📄 File details:', {
      name: uploadedFile.originalFilename,
      size: uploadedFile.size,
      type: uploadedFile.mimetype,
      path: uploadedFile.filepath
    });

    // Get folder ID from the form data
    const folderId = fields.folderId?.[0];
    
    if (!folderId) {
      console.log('❌ No folder ID provided');
      return res.status(400).json({ error: 'No folder ID provided. Please select a mentee first.' });
    }

    console.log('🗂️ Using folder ID:', folderId);

    // Check if credentials are available
    if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
      console.log('❌ GOOGLE_CREDENTIALS_BASE64 not found in environment');
      return res.status(500).json({ error: 'Google credentials not configured' });
    }

    console.log('🔐 Initializing Google Drive authentication...');
    
    // Authentication for Google Drive
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    console.log('☁️ Uploading file to Google Drive...');
// ✅ PRE-FLIGHT CHECK: ensure folder exists & is accessible (Shared Drive safe)
await drive.files.get({
  fileId: folderId,
  fields: 'id, name',
  supportsAllDrives: true,
});

    // Upload file to Google Drive
    const fileMetadata = {
      name: uploadedFile.originalFilename,
      parents: [folderId],
    };

    const media = {
      mimeType: uploadedFile.mimetype,
      body: fs.createReadStream(uploadedFile.filepath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true, // ✅ REQUIRED for Shared Drive
    });

    console.log('✅ File uploaded successfully:', {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink
    });

    // Make the file publicly accessible
    console.log('🌐 Setting file permissions to public...');
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true, // ✅ REQUIRED for Shared Drive
    });

    console.log('🧹 Cleaning up temporary file...');
    // Delete the temporary file after upload
    fs.unlink(uploadedFile.filepath, (err) => {
      if (err) console.error("Error deleting temp file:", err);
      else console.log('✅ Temporary file deleted');
    });

    // Prepare response
    const responseData = {
      url: response.data.webViewLink || response.data.webContentLink,
      id: response.data.id,
      fileName: uploadedFile.originalFilename
    };

    console.log('📤 Sending response:', responseData);

    // Return the URL for the frontend
    res.status(200).json(responseData);

  } catch (error) {
    console.error("❌ Detailed error in upload-image API:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status
    });
    
    res.status(500).json({ 
      error: 'Failed to upload image.', 
      details: error.message,
      code: error.code
    });
  }


}
