import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabaseAdmin';
import { google } from 'googleapis';

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
      console.error('⚠️ GOOGLE_SHEETS_MAPPING_ID not configured');
      return;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'mapping!A:L',
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.warn('⚠️ No data in mapping sheet');
      return;
    }

    let rowIndex = -1;

    // Find row by mentee email (col K = index 10) OR mentee name (col E = index 4)
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
      console.warn(`⚠️ Mentee ${menteeName} not found in mapping sheet`);
      return;
    }

    // Update col C (index 2) = mentor name, col D (index 3) = mentor email
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

    console.log(`✅ Updated mapping sheet for ${menteeName} → ${newMentorName}`);
  } catch (error) {
    console.error(`⚠️ Sheets sync failed for ${menteeName} (non-blocking):`, error.message);
  }
}

export default async function handler(req, res) {
  const supabaseAdmin = createAdminClient();

  // 1. Auth
  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  // 2. Handle GET request - fetch mentees for a mentor
  if (req.method === 'GET') {
    const { mentorId } = req.query;

    if (!mentorId || typeof mentorId !== 'string' || !mentorId.trim()) {
      return res.status(400).json({ error: 'mentorId is required' });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('mentor_assignments')
        .select(`
          id,
          batch_id,
          entrepreneur_id,
          entrepreneurs (
            id,
            name,
            email,
            program,
            batch,
            zone,
            folder_id
          ),
          batches (
            batch_name
          )
        `)
        .eq('mentor_id', mentorId)
        .eq('status', 'active')
        .eq('is_active', true)
        .order('entrepreneurs(name)', { ascending: true });

      console.log('reassign-mentor mentees raw result:', {
        mentorId,
        count: data?.length || 0,
        error
      });

      if (error) throw error;

      const mentees = data.map(a => ({
        assignmentId: a.id,
        batchId: a.batch_id,
        entrepreneurId: a.entrepreneur_id,
        name: a.entrepreneurs?.name || '',
        email: a.entrepreneurs?.email || '',
        program: a.entrepreneurs?.program || '',
        batch: a.entrepreneurs?.batch || '',
        zone: a.entrepreneurs?.zone || '',
        folderId: a.entrepreneurs?.folder_id || '',
        batchName: a.batches?.batch_name || ''
      }));

      return res.status(200).json({ success: true, data: mentees });
    } catch (error) {
      console.error('Error fetching mentees:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // 3. Handle POST request - reassign mentees
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 4. Input validation for POST
  const { sourceMentorId, reassignments } = req.body;

  if (!sourceMentorId || typeof sourceMentorId !== 'string' || !sourceMentorId.trim()) {
    return res.status(400).json({ error: 'sourceMentorId is required' });
  }

  if (!Array.isArray(reassignments)) {
    return res.status(400).json({ error: 'reassignments array is required' });
  }

  // Validate each reassignment has required fields
  for (const item of reassignments) {
    if (!item.assignmentId || !item.entrepreneurId || !item.newMentorId ||
        !item.newMentorEmail || !item.menteeName) {
      return res.status(400).json({
        error: 'Each reassignment must have: assignmentId, entrepreneurId, newMentorId, newMentorEmail, menteeName'
      });
    }
  }

  if (reassignments.length === 0) {
    return res.status(200).json({
      success: true,
      updated: [],
      errors: []
    });
  }

  // 4. Process reassignments
  const updated = [];
  const errors = [];

  for (const item of reassignments) {
    try {
      const {
        assignmentId,
        entrepreneurId,
        batchId,
        newMentorId,
        newMentorEmail,
        newMentorName,
        menteeName,
        menteeEmail,
        folderId
      } = item;

      // Get users.id for the new mentor (newMentorUserId)
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', newMentorEmail)
        .single();

      if (userError || !userData) {
        console.error(`⚠️ User not found for ${newMentorEmail}:`, userError);
        errors.push({
          menteeName,
          error: `User account not found for mentor ${newMentorName}`
        });
        continue;
      }

      const newMentorUserId = userData.id;

      // Step 1: Mark old assignment as transferred
      const { error: updateError } = await supabaseAdmin
        .from('mentor_assignments')
        .update({
          status: 'transferred',
          is_active: false,
          transferred_to: newMentorUserId,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (updateError) {
        console.error(`❌ Failed to update assignment ${assignmentId}:`, updateError);
        errors.push({
          menteeName,
          error: `Failed to update old assignment: ${updateError.message}`
        });
        continue;
      }

      // Step 2: Create new assignment
      const { error: insertError } = await supabaseAdmin
        .from('mentor_assignments')
        .insert({
          mentor_id: newMentorId,
          entrepreneur_id: entrepreneurId,
          batch_id: batchId || null,
          status: 'active',
          is_active: true,
          assigned_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`❌ Failed to insert new assignment for ${menteeName}:`, insertError);
        errors.push({
          menteeName,
          error: `Failed to create new assignment: ${insertError.message}`
        });
        continue;
      }

      // Step 3: Update folder_id if provided
      if (folderId && typeof folderId === 'string' && folderId.trim()) {
        const { error: folderError } = await supabaseAdmin
          .from('entrepreneurs')
          .update({
            folder_id: folderId.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', entrepreneurId);

        if (folderError) {
          console.error(`⚠️ Failed to update folder_id for ${menteeName}:`, folderError);
        }
      }

      // Step 4: Google Sheets sync (NON-BLOCKING, fire-and-forget)
      updateMappingSheet(menteeName, menteeEmail, newMentorName, newMentorEmail).catch(err => {
        console.error(`⚠️ Sheets sync error for ${menteeName} (non-blocking):`, err);
      });

      // Step 5: Activity log
      const { error: logError } = await supabaseAdmin
        .from('activity_logs')
        .insert({
          action: 'mentee_reassigned',
          table_name: 'mentor_assignments',
          record_id: entrepreneurId,
          old_values: {
            mentor_id: sourceMentorId,
            mentee_name: menteeName,
            mentee_email: menteeEmail
          },
          new_values: {
            mentor_id: newMentorId,
            mentor_name: newMentorName,
            mentor_email: newMentorEmail
          },
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.error(`⚠️ Failed to log activity for ${menteeName}:`, logError);
      }

      // Success
      updated.push({
        menteeName,
        fromMentor: 'Source Mentor',
        toMentor: newMentorName
      });

      console.log(`✅ Successfully reassigned ${menteeName} → ${newMentorName}`);

    } catch (err) {
      console.error(`❌ Unexpected error processing ${item.menteeName}:`, err);
      errors.push({
        menteeName: item.menteeName,
        error: err.message || 'Unexpected error'
      });
    }
  }

  // Return results
  if (errors.length === 0) {
    return res.status(200).json({
      success: true,
      updated,
      errors: []
    });
  } else if (updated.length > 0) {
    // Partial success
    return res.status(200).json({
      success: false,
      updated,
      errors
    });
  } else {
    // Complete failure
    return res.status(500).json({
      success: false,
      updated: [],
      errors,
      error: 'All reassignments failed'
    });
  }
}
