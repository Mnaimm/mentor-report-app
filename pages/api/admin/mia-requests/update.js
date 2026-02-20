// pages/api/admin/mia-requests/update.js
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessAdmin, getUserName } from '../../../../lib/auth';
import { MIA_STATUS } from '../../../../lib/mia';

// Service role client (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Authentication check
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const adminEmail = session.user.email;

    // 2. Authorization - Check if user can access admin
    const hasAccess = await canAccessAdmin(adminEmail);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden - Admin access required',
        success: false
      });
    }

    // 3. Validate request body
    const { requestId, status, rejectionReason } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'Request ID is required'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    // Validate status value
    const validStatuses = Object.values(MIA_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // If status is rejected, rejection reason is required
    if (status === MIA_STATUS.REJECTED && !rejectionReason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required when rejecting MIA'
      });
    }

    // 4. Prepare update data
    const updateData = {
      status,
      admin_id: adminEmail,
      admin_name: session.user.name || adminEmail,
      updated_at: new Date().toISOString()
    };

    // Add timestamp fields based on status
    if (status === MIA_STATUS.BIMB_CONTACTED) {
      updateData.bimb_contacted_at = new Date().toISOString();
    } else if (status === MIA_STATUS.APPROVED) {
      updateData.approved_at = new Date().toISOString();
    } else if (status === MIA_STATUS.REJECTED) {
      updateData.rejection_reason = rejectionReason;
    }

    // 5. Update the MIA request in database
    const { data, error } = await supabase
      .from('mia_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Error updating MIA request:', error);
      throw error;
    }

    // 6. TODO: Update corresponding Google Sheets row with new MIA status
    // This will be handled in the next iteration
    // For now, we're just updating Supabase

    return res.status(200).json({
      success: true,
      message: 'MIA request status updated successfully',
      data
    });

  } catch (error) {
    console.error('Error in mia-requests/update API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
