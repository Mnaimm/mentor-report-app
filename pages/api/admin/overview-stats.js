import { createClient } from '@supabase/supabase-js';
import { getSession } from 'next-auth/react';
import { canAccessAdmin } from '../../../lib/auth';

// Use SERVICE_ROLE_KEY for admin endpoints (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 1. Auth
  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  // 2. Method check
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Pending Verification: reports submitted but not yet approved
    const { count: pendingVerification, error: e1 } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted');

    if (e1) throw e1;

    // Open MIA: MIA requests not yet approved or rejected
    const { count: openMIA, error: e2 } = await supabase
      .from('mia_requests')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '(approved,rejected)');

    if (e2) throw e2;

    // Unpaid Approved: reports approved but payment still pending
    const { count: unpaidApproved, error: e3 } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('payment_status', 'pending');

    if (e3) throw e3;

    // Active Payment Batches: batches not yet paid
    const { count: activePaymentBatches, error: e4 } = await supabase
      .from('payment_batches')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'paid');

    if (e4) throw e4;

    return res.status(200).json({
      success: true,
      data: {
        pendingVerification: pendingVerification || 0,
        openMIA: openMIA || 0,
        unpaidApproved: unpaidApproved || 0,
        activePaymentBatches: activePaymentBatches || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching overview stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
