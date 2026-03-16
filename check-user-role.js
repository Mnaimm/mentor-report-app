// Quick script to check user roles
const { createClient } = require('@supabase/supabase-js');

// Read from .env.local
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserRoles(email) {
  console.log('🔍 Checking roles for:', email);
  console.log('');

  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('email', email);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('📊 Database Results:');
  console.log('   Rows found:', data?.length || 0);
  console.log('');

  if (data && data.length > 0) {
    console.log('✅ USER HAS ACCESS');
    console.log('');
    console.log('📋 Assigned Roles:');
    data.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.role}`);
      console.log(`      Assigned by: ${row.assigned_by || 'N/A'}`);
      console.log(`      Date: ${row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}`);
    });

    console.log('');
    console.log('🔐 Access Permissions:');
    const roles = data.map(r => r.role);

    // Check admin access
    const canAccessAdmin = roles.some(r => ['system_admin', 'program_coordinator', 'report_admin', 'payment_admin', 'stakeholder'].includes(r));
    console.log(`   /admin/dashboard: ${canAccessAdmin ? '✅ YES' : '❌ NO'}`);

    // Check coordinator access
    const canAccessCoordinator = roles.some(r => ['system_admin', 'program_coordinator', 'stakeholder'].includes(r));
    console.log(`   /coordinator/dashboard: ${canAccessCoordinator ? '✅ YES' : '❌ NO'}`);

    // Check payment access
    const canAccessPayment = roles.some(r => ['system_admin', 'payment_admin'].includes(r));
    console.log(`   /admin/payment: ${canAccessPayment ? '✅ YES' : '❌ NO'}`);

    // Check superadmin access
    const canAccessSuperadmin = roles.includes('system_admin');
    console.log(`   /superadmin/roles: ${canAccessSuperadmin ? '✅ YES' : '❌ NO'}`);

  } else {
    console.log('❌ NO ROLES FOUND');
    console.log('');
    console.log('This user cannot access admin pages.');
    console.log('');
    console.log('💡 To fix:');
    console.log('   1. Go to /superadmin/roles');
    console.log('   2. Add role for this email');
    console.log('   3. Or check if email is spelled correctly');
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'noraminah.omar@startlah.my';
checkUserRoles(email);
