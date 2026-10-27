/**
 * Replay a failed upward_mobility_reports write from dual_write_monitoring.
 *
 * submitBangkit / submitMajuReportum store a replayable row when the UM insert fails twice
 * (lib/umDbWrite.js): status='failed', table_name='upward_mobility_reports',
 * metadata.replayable=true, metadata.um_payload=<exact insert payload>, metadata.report_id.
 *
 * Usage:
 *   node scripts/replay-um-failure.js --list                 # list pending replayable failures
 *   node scripts/replay-um-failure.js --id <monitoring_id>   # dry run: show checks + payload
 *   node scripts/replay-um-failure.js --id <monitoring_id> --apply
 *   add --force to insert even if a UM row for the same entrepreneur + program + sesi exists
 *
 * Dry run is the default (read before write). Nothing is written without --apply.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback

const { createSupabaseClient } = require('./lib/supabase-client');

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const LIST = args.includes('--list');
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');
const MONITORING_ID = argValue('--id');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listPending(supabase) {
  const { data, error } = await supabase
    .from('dual_write_monitoring')
    .select('id, timestamp, error_message, metadata')
    .eq('table_name', 'upward_mobility_reports')
    .eq('status', 'failed')
    .order('timestamp', { ascending: false })
    .limit(200);
  if (error) throw error;

  const pending = (data || []).filter((r) => r.metadata?.replayable === true && !r.metadata?.replayed_at);
  console.log(`Pending replayable UM failures: ${pending.length}`);
  for (const r of pending) {
    const m = r.metadata;
    console.log(`- ${r.id}  ${r.timestamp}  ${m.program} sesi ${m.sesi}  report ${m.report_id}  entrepreneur ${m.entrepreneur_id}  error: ${(r.error_message || '').slice(0, 80)}`);
  }
}

async function replay(supabase, id) {
  if (!UUID_RE.test(id || '')) throw new Error('--id must be a dual_write_monitoring UUID');

  const { data: row, error } = await supabase
    .from('dual_write_monitoring')
    .select('id, status, table_name, error_message, metadata')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error(`No dual_write_monitoring row ${id}`);

  const m = row.metadata || {};
  const payload = m.um_payload;
  if (row.table_name !== 'upward_mobility_reports' || row.status !== 'failed') throw new Error('Not a failed upward_mobility_reports record');
  if (m.replayable !== true || !payload) throw new Error('Record is not replayable (no um_payload). Recover manually from metadata.raw_um_json.');
  if (m.replayed_at) throw new Error(`Already replayed at ${m.replayed_at} as ${m.replayed_um_id}`);

  console.log(`Monitoring row ${row.id}: ${m.program} sesi ${m.sesi}, report ${m.report_id}`);
  console.log(`Original error: ${row.error_message}`);

  // Check 1: the report this UM row belongs to still exists
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id, entrepreneur_id, program, session_number')
    .eq('id', m.report_id)
    .maybeSingle();
  if (reportError) throw reportError;
  if (!report) throw new Error(`reports row ${m.report_id} not found — not replaying`);
  if (report.entrepreneur_id !== payload.entrepreneur_id) throw new Error('reports.entrepreneur_id does not match the UM payload — not replaying');
  console.log(`✅ Report found (${report.program} sesi ${report.session_number})`);

  // Check 2: the original request's row (same entrepreneur + created_at token) was not committed after all
  const { data: sameRequest, error: sameRequestError } = await supabase
    .from('upward_mobility_reports')
    .select('id')
    .eq('entrepreneur_id', payload.entrepreneur_id)
    .eq('created_at', payload.created_at)
    .limit(1);
  if (sameRequestError) throw sameRequestError;
  if (sameRequest?.length) throw new Error(`UM row from this request already exists (${sameRequest[0].id}) — nothing to replay`);

  // Check 3: no other UM row for the same entrepreneur + program + sesi
  const { data: sameSesi, error: sameSesiError } = await supabase
    .from('upward_mobility_reports')
    .select('id, created_at')
    .eq('entrepreneur_id', payload.entrepreneur_id)
    .eq('program', payload.program)
    .eq('sesi_mentoring', payload.sesi_mentoring);
  if (sameSesiError) throw sameSesiError;
  if (sameSesi?.length) {
    console.warn(`⚠️ ${sameSesi.length} UM row(s) already exist for this entrepreneur + ${payload.program} + ${payload.sesi_mentoring}: ${sameSesi.map((r) => r.id).join(', ')}`);
    if (!FORCE) throw new Error('Refusing to create a duplicate. Re-run with --force if this is intended.');
  }

  console.log('Payload to insert:');
  console.log(JSON.stringify(payload, null, 2));

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to insert.');
    return;
  }

  // Keep the original created_at (submission time); updated_at marks the replay.
  const insertPayload = { ...payload, updated_at: new Date().toISOString() };
  const { data: inserted, error: insertError } = await supabase
    .from('upward_mobility_reports')
    .insert(insertPayload)
    .select('id');
  if (insertError) throw insertError;
  const umId = inserted?.[0]?.id;
  console.log(`✅ Inserted upward_mobility_reports ${umId}`);

  const { error: markError } = await supabase
    .from('dual_write_monitoring')
    .update({ metadata: { ...m, replayed_at: new Date().toISOString(), replayed_um_id: umId } })
    .eq('id', row.id);
  if (markError) console.error(`⚠️ Inserted, but could not mark monitoring row as replayed: ${markError.message}`);
  else console.log(`✅ Marked monitoring row ${row.id} as replayed`);
}

(async () => {
  const supabase = createSupabaseClient();
  if (LIST) return listPending(supabase);
  if (MONITORING_ID) return replay(supabase, MONITORING_ID);
  console.log('Usage: --list | --id <monitoring_id> [--apply] [--force]');
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
