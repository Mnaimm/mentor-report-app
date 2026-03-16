/**
 * Check dual-write logs for the 2 web form submissions on 31/01/2026
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDualWriteLogs() {
    console.log('📊 Checking Dual-Write Logs for Failed Sheets Writes');
    console.log('='.repeat(80));
    console.log('Date: 31/01/2026');
    console.log('Affected records:');
    console.log('  - Nisha Binti Junus');
    console.log('  - Muhammad As-Shahkirin Bin Mohd Hussin\n');

    // Get the report IDs
    const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('id, nama_usahawan, submission_date')
        .eq('program', 'Maju')
        .eq('session_number', 2)
        .eq('source', 'web_form')
        .in('nama_usahawan', ['Nisha Binti Junus', 'Muhammad As-Shahkirin Bin Mohd Hussin']);

    if (reportsError) throw reportsError;

    console.log(`Found ${reports.length} web form reports\n`);

    reports.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.nama_usahawan}`);
        console.log(`   ID: ${r.id}`);
        console.log(`   Submitted: ${new Date(r.submission_date).toLocaleString()}`);
        console.log('');
    });

    // Check dual_write_logs table
    console.log('🔍 Checking dual_write_logs table...\n');

    const reportIds = reports.map(r => r.id);

    const { data: logs, error: logsError } = await supabase
        .from('dual_write_logs')
        .select('*')
        .in('record_id', reportIds)
        .order('created_at', { ascending: false });

    if (logsError) {
        console.log(`⚠️  Error querying dual_write_logs: ${logsError.message}`);
        console.log(`   This table might not exist or might use a different structure\n`);
    } else if (logs.length === 0) {
        console.log('❌ No entries found in dual_write_logs for these report IDs\n');
    } else {
        console.log(`✅ Found ${logs.length} log entries:\n`);
        logs.forEach((log, idx) => {
            console.log(`[${idx + 1}] ${new Date(log.created_at).toLocaleString()}`);
            console.log(`    Record ID: ${log.record_id}`);
            console.log(`    Operation: ${log.operation_type}`);
            console.log(`    Supabase: ${log.supabase_success ? '✅' : '❌'}`);
            console.log(`    Sheets: ${log.sheets_success ? '✅' : '❌'}`);
            if (log.sheets_error) {
                console.log(`    Sheets Error: ${log.sheets_error}`);
            }
            console.log('');
        });
    }

    // Also check if there's a dual_write_monitoring table (old naming)
    console.log('🔍 Checking alternative table: dual_write_monitoring...\n');

    const { data: monitoringLogs, error: monitoringError } = await supabase
        .from('dual_write_monitoring')
        .select('*')
        .in('record_id', reportIds)
        .order('created_at', { ascending: false });

    if (monitoringError) {
        console.log(`⚠️  dual_write_monitoring table not found or error: ${monitoringError.message}\n`);
    } else if (monitoringLogs.length === 0) {
        console.log('❌ No entries found in dual_write_monitoring\n');
    } else {
        console.log(`✅ Found ${monitoringLogs.length} entries:\n`);
        monitoringLogs.forEach((log, idx) => {
            console.log(`[${idx + 1}] ${new Date(log.created_at).toLocaleString()}`);
            console.log(`    Record ID: ${log.record_id}`);
            console.log(`    Operation: ${log.operation_type}`);
            console.log(`    Success: ${log.success ? '✅' : '❌'}`);
            if (log.error_message) {
                console.log(`    Error: ${log.error_message}`);
            }
            console.log('');
        });
    }

    // Analysis
    console.log('='.repeat(80));
    console.log('📊 ANALYSIS\n');

    if (logs && logs.length > 0) {
        const failedSheets = logs.filter(l => !l.sheets_success);
        if (failedSheets.length > 0) {
            console.log(`❌ Sheets write failures detected: ${failedSheets.length} out of ${logs.length}`);
            console.log('\nReasons:');
            failedSheets.forEach(l => {
                console.log(`   - ${l.sheets_error || 'Unknown error'}`);
            });
        } else {
            console.log(`✅ All logged operations show Sheets success`);
            console.log(`   ⚠️  BUT rows 35-36 were empty before backfill`);
            console.log(`   → Possible causes:`);
            console.log(`      1. Sheets write succeeded but Apps Script didn't save`);
            console.log(`      2. Sheets API timeout after logging success`);
            console.log(`      3. Manual deletion of rows after submission`);
        }
    } else {
        console.log('⚠️  No dual-write logs found for these submissions');
        console.log('   Possible causes:');
        console.log('   1. Logging was not implemented on 31/01/2026');
        console.log('   2. Logs were purged/deleted');
        console.log('   3. Reports were submitted via different mechanism');
    }

    console.log('\n' + '='.repeat(80));
}

checkDualWriteLogs().catch(console.error);
