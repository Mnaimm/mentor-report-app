// pages/api/upload-image.js
import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs'; // Node.js file system module

// Disable bodyParser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const form = new IncomingForm();

  try {
    const [fields, files] = await form.parse(req);
    const uploadedFile = files.file?.[0]; // Access the file array, then the first item
    
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Extract folder ID from NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_URL
    const driveFolderUrl = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_URL;
    if (!driveFolderUrl) {
      return res.status(500).json({ error: 'GOOGLE_DRIVE_UPLOAD_FOLDER_ID is not set in environment variables.' });
    }
    const folderIdMatch = driveFolderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const folderId = folderIdMatch ? folderIdMatch[1] : null;

    if (!folderId) {
      return res.status(500).json({ error: 'Could not extract Google Drive Folder ID from URL.' });
    }

    // --- Authentication for Google Drive ---
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'], // Scope for file management
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // --- Upload file to Google Drive ---
    const fileMetadata = {
      name: uploadedFile.originalFilename,
      parents: [folderId],
      mimeType: uploadedFile.mimetype,
    };

    const media = {
      mimeType: uploadedFile.mimetype,
      body: fs.createReadStream(uploadedFile.filepath), // Read the uploaded file from its temp path
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink, parents', // Request relevant fields including parents
    });

    // Make the file publicly accessible
    await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    // Delete the temporary file after upload
    fs.unlink(uploadedFile.filepath, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    // Return the URL for the frontend
    // Prioritize webViewLink (viewable in browser) over webContentLink (downloadable)
    res.status(200).json({ url: response.data.webViewLink || response.data.webContentLink, id: response.data.id });

  } catch (error) {
    console.error("❌ Error uploading file:", error);
    res.status(500).json({ error: 'Failed to upload image.', details: error.message });
  }
}