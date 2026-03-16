import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../lib/auth';

export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const userEmail = session.user.email;
    const hasAccess = await canAccessAdmin(userEmail);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const { fileId } = req.query;
    if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

    try {
        const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
        const credentials = JSON.parse(credentialsJson);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // 1. Get file metadata (to set Content-Type)
        const fileMetadata = await drive.files.get({
            fileId,
            fields: 'mimeType, name, size',
        });

        const mimeType = fileMetadata.data.mimeType;
        const fileName = fileMetadata.data.name;

        // If it's a Google Doc/Sheet, we need to export it instead of getting media
        if (mimeType.startsWith('application/vnd.google-apps.')) {
            // Default export to PDF
            const exportMimeType = 'application/pdf';
            res.setHeader('Content-Type', exportMimeType);
            res.setHeader('Content-Disposition', `inline; filename="${fileName}.pdf"`);

            const response = await drive.files.export({
                fileId,
                mimeType: exportMimeType,
            }, { responseType: 'stream' });

            response.data.pipe(res);
        } else {
            // For regular files (PDF, images), get raw media
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

            const response = await drive.files.get({
                fileId,
                alt: 'media',
            }, { responseType: 'stream' });

            response.data.pipe(res);
        }

    } catch (error) {
        console.error('Error proxying drive file:', error);
        res.status(500).json({ error: 'Failed to fetch file from Drive' });
    }
}
