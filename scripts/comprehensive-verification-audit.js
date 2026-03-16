// scripts/comprehensive-verification-audit.js
// Complete audit of the verification system

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 COMPREHENSIVE VERIFICATION SYSTEM AUDIT\n');
console.log('='.repeat(80) + '\n');

async function runAudit() {
  try {
    // TASK 3A: Reports Table Structure
    console.log('📊 TASK 3A: Reports Table Structure');
    console.log('-'.repeat(80));

    // Query info schema directly
    const sampleReport = await supabase
      .from('reports')
      .select('*')
      .limit(1)
      .single();

    if (sampleReport.data) {
      console.log('\nAvailable Columns:');
      Object.keys(sampleReport.data).sort().forEach((col, idx) => {
        const value = sampleReport.data[col];
        const type = Array.isArray(value) ? 'array' :
                     typeof value === 'object' && value !== null ? 'object/jsonb' :
                     typeof value;
        console.log(`${String(idx + 1).padStart(2)}. ${col.padEnd(35)} → ${type}`);
      });
    }

    // TASK 3B: Sample Report Data (the one from screenshot)
    console.log('\n' + '='.repeat(80));
    console.log('📊 TASK 3B: Sample Report Data (ID from screenshot)');
    console.log('-'.repeat(80));

    const { data: reportData, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', 'c4a37eff-9076-4151-9f2a-fc3e8390fc02')
      .single();

    if (reportData) {
      console.log('\n✅ Report Found:');
      console.log(JSON.stringify({
        id: reportData.id,
        mentor_name: reportData.nama_mentor,
        mentee_name: reportData.nama_usahawan,
        program: reportData.program,
        session: reportData.session_number,
        status: reportData.status,
        submission_date: reportData.submission_date,
        document_url: reportData.document_url ? 'Present' : 'Missing',
        sheets_row_number: reportData.sheets_row_number,
        payment_status: reportData.payment_status,
        reviewed_at: reportData.reviewed_at,
        reviewed_by: reportData.reviewed_by,
        inisiatif: reportData.inisiatif ? `${reportData.inisiatif.length} items` : 'None',
        image_urls: reportData.image_urls ? Object.keys(reportData.image_urls) : 'None'
      }, null, 2));
    } else {
      console.log('❌ Report not found (may have different ID)');
    }

    // TASK 3C: All Report Statuses
    console.log('\n' + '='.repeat(80));
    console.log('📊 TASK 3C: Report Status Distribution');
    console.log('-'.repeat(80));

    const { data: statusData } = await supabase
      .from('reports')
      .select('status, created_at');

    const statusCounts = {};
    let oldest = null;
    let newest = null;

    statusData.forEach(r => {
      const status = r.status || 'NULL';
      if (!statusCounts[status]) {
        statusCounts[status] = { count: 0, oldest: r.created_at, newest: r.created_at };
      }
      statusCounts[status].count++;

      if (!oldest || new Date(r.created_at) < new Date(oldest)) oldest = r.created_at;
      if (!newest || new Date(r.created_at) > new Date(newest)) newest = r.created_at;

      if (new Date(r.created_at) < new Date(statusCounts[status].oldest)) {
        statusCounts[status].oldest = r.created_at;
      }
      if (new Date(r.created_at) > new Date(statusCounts[status].newest)) {
        statusCounts[status].newest = r.created_at;
      }
    });

    console.log('\nStatus Breakdown:');
    Object.entries(statusCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([status, info]) => {
        console.log(`\n  ${status}:`);
        console.log(`    Count: ${info.count}`);
        console.log(`    Oldest: ${new Date(info.oldest).toLocaleDateString()}`);
        console.log(`    Newest: ${new Date(info.newest).toLocaleDateString()}`);
      });

    console.log(`\n  Total Reports: ${statusData.length}`);
    console.log(`  Date Range: ${new Date(oldest).toLocaleDateString()} → ${new Date(newest).toLocaleDateString()}`);

    // TASK 3D: Check for Review-Related Tables
    console.log('\n' + '='.repeat(80));
    console.log('📊 TASK 3D: Review-Related Tables Check');
    console.log('-'.repeat(80));

    // Get list of all tables
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .catch(() => ({ data: [] }));

    // Try a different approach - just try to query some common table names
    const tablesToCheck = [
      'reports',
      'user_roles',
      'batch_rounds',
      'mentor_mentee_mapping',
      'review_queue',
      'report_reviews',
      'verifications',
      'approvals',
      'payments',
      'dual_write_monitoring'
    ];

    console.log('\nTable Existence Check:');
    for (const tableName of tablesToCheck) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        console.log(`  ✅ ${tableName.padEnd(30)} → EXISTS`);
      } else {
        console.log(`  ❌ ${tableName.padEnd(30)} → NOT FOUND`);
      }
    }

    // TASK 7: Check Payment Fields
    console.log('\n' + '='.repeat(80));
    console.log('📊 TASK 8: Payment Integration Check');
    console.log('-'.repeat(80));

    const { data: paymentCheck } = await supabase
      .from('reports')
      .select('payment_status, base_payment_amount, adjusted_payment_amount, approved_at')
      .limit(10);

    if (paymentCheck && paymentCheck.length > 0) {
      const paymentStats = {
        has_payment_status: paymentCheck.filter(r => r.payment_status).length,
        has_base_amount: paymentCheck.filter(r => r.base_payment_amount).length,
        has_adjusted_amount: paymentCheck.filter(r => r.adjusted_payment_amount).length,
        has_approval_date: paymentCheck.filter(r => r.approved_at).length
      };

      console.log('\nPayment Field Population (sample of 10):');
      console.log(`  payment_status: ${paymentStats.has_payment_status}/10`);
      console.log(`  base_payment_amount: ${paymentStats.has_base_amount}/10`);
      console.log(`  adjusted_payment_amount: ${paymentStats.has_adjusted_amount}/10`);
      console.log(`  approved_at: ${paymentStats.has_approval_date}/10`);
    }

    // Check for specific report with document_url
    console.log('\n' + '='.repeat(80));
    console.log('📊 Document URL Analysis');
    console.log('-'.repeat(80));

    const { data: urlStats } = await supabase
      .from('reports')
      .select('document_url, google_doc_url, doc_url, sheets_row_number');

    const urlAnalysis = {
      has_document_url: urlStats.filter(r => r.document_url).length,
      has_google_doc_url: urlStats.filter(r => r.google_doc_url).length,
      has_doc_url: urlStats.filter(r => r.doc_url).length,
      has_row_number: urlStats.filter(r => r.sheets_row_number).length,
      total: urlStats.length
    };

    console.log('\nDocument URL Field Usage:');
    console.log(`  document_url:      ${urlAnalysis.has_document_url}/${urlAnalysis.total} (${Math.round(urlAnalysis.has_document_url/urlAnalysis.total*100)}%)`);
    console.log(`  google_doc_url:    ${urlAnalysis.has_google_doc_url}/${urlAnalysis.total} (${Math.round(urlAnalysis.has_google_doc_url/urlAnalysis.total*100)}%)`);
    console.log(`  doc_url:           ${urlAnalysis.has_doc_url}/${urlAnalysis.total} (${Math.round(urlAnalysis.has_doc_url/urlAnalysis.total*100)}%)`);
    console.log(`  sheets_row_number: ${urlAnalysis.has_row_number}/${urlAnalysis.total} (${Math.round(urlAnalysis.has_row_number/urlAnalysis.total*100)}%)`);

    // Get a sample URL to analyze
    const sampleWithUrl = urlStats.find(r => r.document_url || r.google_doc_url || r.doc_url);
    if (sampleWithUrl) {
      console.log('\nSample URL:');
      console.log(`  document_url: ${sampleWithUrl.document_url || 'null'}`);
      console.log(`  google_doc_url: ${sampleWithUrl.google_doc_url || 'null'}`);
      console.log(`  doc_url: ${sampleWithUrl.doc_url || 'null'}`);
      console.log(`  sheets_row_number: ${sampleWithUrl.sheets_row_number || 'null'}`);
    }

  } catch (error) {
    console.error('\n❌ Audit Error:', error.message);
    console.error(error);
  }
}

runAudit();
