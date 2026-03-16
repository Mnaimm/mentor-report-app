import { createClient } from '@supabase/supabase-js';
import { getSession } from 'next-auth/react';
import { canAccessAdmin } from '../../../lib/auth';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getGoogleAuth = () => {
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
  const credentials = JSON.parse(credentialsJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

async function updateMappingSheet(menteeName, menteeEmail, newMentorName, newMentorEmail) {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAPPING_ID;

    if (!spreadsheetId) {
      console.error('GOOGLE_SHEETS_MAPPING_ID not configured');
      return;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'mapping!A:L',
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return;

    let rowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      const nameInSheet = (rows[i][4] || '').toLowerCase().trim();
      const emailInSheet = (rows[i][10] || '').toLowerCase().trim();

      const targetName = menteeName.toLowerCase().trim();
      const targetEmail = menteeEmail ? menteeEmail.toLowerCase().trim() : '';

      if ((emailInSheet && targetEmail && emailInSheet === targetEmail) ||
          (!emailInSheet && nameInSheet === targetName)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      console.warn(`Mentee ${menteeName} not found in mapping sheet`);
      return;
    }

    const updates = [
      {
        range: `mapping!C${rowIndex}`,
        values: [[newMentorName]]
      },
      {
        range: `mapping!D${rowIndex}`,
        values: [[newMentorEmail]]
      }
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates
      }
    });

    console.log(`✅ Updated mapping sheet for ${menteeName}`);
  } catch (error) {
    console.error(`⚠️ Failed to update mapping sheet for ${menteeName}:`, error);
  }
}

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    newMentorId,
    newMentorUserId,
    newMentorName,
    newMentorEmail,
    reassignments
  } = req.body;

  if (!newMentorId || !newMentorUserId || !reassignments || reassignments.length === 0) {
    return res.status(400).json({
      error: 'Missing required fields: newMentorId, newMentorUserId, reassignments'
    });
  }

  for (const item of reassignments) {
    if (!item.assignmentId || !item.entrepreneurId) {
      return res.status(400).json({
        error: 'Each reassignment must have assignmentId and entrepreneurId'
      });
    }
  }

  const updatedMentees = [];
  const errors = [];

  try {
    for (const item of reassignments) {
      const {
        assignmentId,
        entrepreneurId,
        batchId,
        folderId,
        menteeEmail,
        menteeName
      } = item;

      try {
        const { error: updateError } = await supabase
          .from('mentor_assignments')
          .update({
            status: 'transferred',
            is_active: false,
            transferred_to: newMentorUserId,
            updated_at: new Date().toISOString()
          })
          .eq('id', assignmentId);

        if (updateError) throw updateError;

        const { error: insertError } = await supabase
          .from('mentor_assignments')
          .insert([{
            mentor_id: newMentorId,
            entrepreneur_id: entrepreneurId,
            batch_id: batchId || null,
            status: 'active',
            is_active: true,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertError) throw insertError;

        if (folderId && folderId.trim()) {
          const { error: folderError } = await supabase
            .from('entrepreneurs')
            .update({
              folder_id: folderId.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', entrepreneurId);

          if (folderError) {
            console.error(`⚠️ Failed to update folder_id for ${entrepreneurId}:`, folderError);
          }
        }

        updateMappingSheet(
          menteeName,
          menteeEmail,
          newMentorName,
          newMentorEmail
        );

        updatedMentees.push(menteeName || 'Unknown');

      } catch (itemError) {
        console.error(`Error processing ${assignmentId}:`, itemError);
        errors.push({
          mentee: menteeName || 'Unknown',
          error: itemError.message
        });
      }
    }

    if (errors.length > 0 && updatedMentees.length === 0) {
      return res.status(500).json({
        success: false,
        error: `Gagal memindahkan mentee: ${errors.map(e => e.error).join(', ')}`
      });
    }

    try {
      await supabase
        .from('activity_logs')
        .insert([{
          action: 'mentor_reassignment',
          entity_type: 'mentor_assignment',
          performed_by: session.user.email,
          details: {
            new_mentor_id: newMentorId,
            new_mentor_name: newMentorName,
            mentees_transferred: updatedMentees.length,
            mentee_names: updatedMentees,
            errors: errors.length > 0 ? errors : undefined
          }
        }]);
    } catch (logErr) {
      console.error('Warning: Failed to log activity:', logErr);
    }

    return res.status(200).json({
      success: true,
      updated: updatedMentees,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in reassign-mentor API:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
