/**
 * Google Apps Script for Bangkit Mentoring Program - Laporan Generation
 * With Upward Mobility Tracking Support
 *
 * This script:
 * 1. Receives file uploads from Next.js frontend
 * 2. Processes document generation requests
 * 3. Reads data from Google Sheets (Bangkit tab)
 * 4. Generates Google Docs reports with Upward Mobility data
 * 5. Manages session subfolders in Google Drive
 * 6. Validates all Inisiatif fields before document generation
 * 7. Robust image insertion with proportional sizing and table-aware layout
 *
 * @version 5.2 - Improved Image Handling (Script A logic)
 * @date 2026-01-26
 */

/***** ================== CONFIG ================== *****/

// Google Sheets Configuration
const REPORT_SHEET_ID = '1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w';
const REPORT_SHEET_NAME = 'Bangkit';  // NEW: Changed from 'V8'
const MAPPING_SHEET_ID = '1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w';
const MAPPING_SHEET_NAME = 'Mapping';

// Document Templates
const TEMPLATE_ID_SESI_1 = '1L5dnhq0-LCwdRvpgUDF0kb2yt-GBhqDiL9CBCD-8qMI';  // NEW Template ID
const TEMPLATE_ID_SESI_2_4 = '1JsSwCJK5SHrTQi5gSXgBa4ZPYws_52eiu-sE0ADvEVQ';  // NEW Template ID

// Bangkit Sheet Headers (82 columns: A-CD)
// Columns A-AZ (0-51): Session data
// Columns BA-BB (52-53): Apps Script fills these (Status, DOC_URL)
// Columns BC-CB (54-81): Upward Mobility data (28 columns)
const H = {
  // A-J (0-9): Basic Session Info
  Timestamp: 'Timestamp',
  Emai: 'Emai',
  StatusSesi: 'Status Sesi',
  SesiLaporan: 'Sesi Laporan',
  TarikhSesi: 'Tarikh Sesi',
  MasaSesi: 'Masa Sesi',
  ModSesi: 'Mod Sesi',
  NamaUsahawan: 'Nama Usahawan',
  NamaBisnes: 'Nama Bisnes',
  NamaMentor: 'Nama Mentor',

  // K (10): Kemaskini Inisiatif
  Update1: 'Update Keputusan Terdahulu 1',

  // L (11): Ringkasan Sesi
  RingkasanSesi: 'Ringkasan Sesi',

  // M-X (12-23): Fokus/Keputusan/Cadangan 1-4 (4 initiatives × 3 fields)
  Fokus1: 'Fokus Area 1',
  Keputusan1: 'Keputusan 1',
  Tindakan1: 'Cadangan Tindakan 1',
  Fokus2: 'Fokus Area 2',
  Keputusan2: 'Keputusan 2',
  Tindakan2: 'Cadangan Tindakan 2',
  Fokus3: 'Fokus Area 3',
  Keputusan3: 'Keputusan 3',
  Tindakan3: 'Cadangan Tindakan 3',
  Fokus4: 'Fokus Area 4',
  Keputusan4: 'Keputusan 4',
  Tindakan4: 'Cadangan Tindakan 4',

  // Y-AJ (24-35): Jualan 12 bulan
  JualanJan: 'Jualan Jan',
  JualanFeb: 'Jualan Feb',
  JualanMac: 'Jualan Mac',
  JualanApr: 'Jualan Apr',
  JualanMei: 'Jualan Mei',
  JualanJun: 'Jualan Jun',
  JualanJul: 'Jualan Jul',
  JualanOgos: 'Jualan Ogos',
  JualanSep: 'Jualan Sep',
  JualanOkt: 'Jualan Okt',
  JualanNov: 'Jualan Nov',
  JualanDis: 'Jualan Dis',

  // AK (36): Link Gambar
  LinkGambar: 'Link Gambar',

  // AL-AM (37-38): Business info
  ProdukServis: 'Produk/Servis',
  PautanMediaSosial: 'Pautan Media Sosial',

  // AN (39): GrowthWheel chart
  LinkCartaGW: 'Link_Carta_GrowthWheel',

  // AO (40): Bukti MIA
  LinkBuktiMIA: 'Link_Bukti_MIA',

  // AP-AW (41-48): Sesi 1 reflection fields
  PanduanPemerhatian: 'Panduan_Pemerhatian_Mentor',
  RefPerasaan: 'Refleksi_Perasaan',
  RefSkor: 'Refleksi_Skor',
  RefAlasan: 'Refleksi_Alasan_Skor',
  RefEliminate: 'Refleksi_Eliminate',
  RefRaise: 'Refleksi_Raise',
  RefReduce: 'Refleksi_Reduce',
  RefCreate: 'Refleksi_Create',

  // AX-AY (49-50): Profile & Premis photos
  LinkGambarProfil: 'Link_Gambar_Profil',
  LinkGambarPremis: 'Link_Gambar_Premis',

  // AZ (51): Premis checkbox
  PremisChecked: 'Premis_Dilawat_Checked',

  // BA-BB (52-53): Apps Script fills these
  Status: 'Status',
  DocUrl: 'DOC_URL',
  MenteeFolderId: 'Mentee_Folder_ID',

  // BC-CB (54-81): UPWARD MOBILITY DATA (28 columns) - NEW
  // Section 1: Engagement Status (3 fields)
  UMStatusPenglibatan: 'UM_STATUS_PENGLIBATAN',
  UMStatus: 'UM_STATUS',
  UMKriteriaImprovement: 'UM_KRITERIA_IMPROVEMENT',

  // Section 2: BIMB Channels & Fintech (6 fields)
  UMAkaunBimb: 'UM_AKAUN_BIMB',
  UMBimbBiz: 'UM_BIMB_BIZ',
  UMAlAwfar: 'UM_AL_AWFAR',
  UMMerchantTerminal: 'UM_MERCHANT_TERMINAL',
  UMFasilitiLain: 'UM_FASILITI_LAIN',
  UMMesinkira: 'UM_MESINKIRA',

  // Section 3: Financial & Employment Metrics (12 fields: 6 values + 6 ulasan)
  UMPendapatanSemasa: 'UM_PENDAPATAN_SEMASA',
  UMUlasanPendapatan: 'UM_ULASAN_PENDAPATAN',
  UMPekerjaSemasa: 'UM_PEKERJA_SEMASA',
  UMUlasanPekerja: 'UM_ULASAN_PEKERJA',
  UMAsetBukanTunaiSemasa: 'UM_ASET_BUKAN_TUNAI_SEMASA',
  UMUlasanAsetBukanTunai: 'UM_ULASAN_ASET_BUKAN_TUNAI',
  UMAsetTunaiSemasa: 'UM_ASET_TUNAI_SEMASA',
  UMUlasanAsetTunai: 'UM_ULASAN_ASET_TUNAI',
  UMSimpananSemasa: 'UM_SIMPANAN_SEMASA',
  UMUlasanSimpanan: 'UM_ULASAN_SIMPANAN',
  UMZakatSemasa: 'UM_ZAKAT_SEMASA',
  UMUlasanZakat: 'UM_ULASAN_ZAKAT',

  // Section 4: Digitalization (2 fields)
  UMDigitalSemasa: 'UM_DIGITAL_SEMASA',
  UMUlasanDigital: 'UM_ULASAN_DIGITAL',

  // Section 5: Marketing (2 fields)
  UMMarketingSemasa: 'UM_MARKETING_SEMASA',
  UMUlasanMarketing: 'UM_ULASAN_MARKETING',

  // Section 6: Premises Visit Date (1 field)
  UMTarikhLawatanPremis: 'UM_TARIKH_LAWATAN_PREMIS'
};

// Mapping Sheet Headers
const M = {
  Batch: 'Batch',
  Zon: 'Zon',
  Mentor: 'Mentor',
  MentorEmail: 'Mentor_Email',
  Mentee: 'Mentee',
  NamaSyarikat: 'Nama Syarikat',
  Alamat: 'Alamat ',
  NoTelefon: 'no Telefon',
  FolderId: 'Folder_ID',
  Email: 'EMAIL',
  JenisBisnes: 'JENIS BISNES'
};

/***** ================== WEB APP HANDLERS ================== *****/

/**
 * Handles GET requests (for testing)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Bangkit Apps Script v5.2 - Improved Image Handling',
    timestamp: new Date().toISOString(),
    note: 'Use POST method with action parameter'
  }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles POST requests - Main entry point
 * Supports two actions:
 * 1. uploadImage - Uploads file to Google Drive
 * 2. processRow - Generates document for specific row
 *
 * @param {Object} e - Event parameter from web app request
 * @returns {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  // Log incoming request
  console.log('=== doPost CALLED ===');
  console.log('Request method:', e?.parameter?.method || 'POST');

  try {
    // Parse request body
    const data = JSON.parse(e.postData.contents || '{}');
    console.log('Action:', data.action);

    // Route based on action
    if (data.action === 'processRow' && data.rowNumber) {
      // AUTOMATION PATH: Process specific row to generate document
      console.log('Processing row:', data.rowNumber);
      const result = processSingleRow(Number(data.rowNumber));
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        result: result
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    else if (data.action === 'uploadImage' || (!data.action && data.fileData)) {
      // UPLOAD PATH: Handle file upload to Google Drive
      return handleFileUpload(data);
    }
    else {
      // Unknown action
      throw new Error('Invalid action. Use "processRow" or "uploadImage"');
    }

  } catch (err) {
    console.error('doPost error:', err.toString());
    console.error('Stack:', err.stack);

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString(),
      stack: err.stack
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles file upload to Google Drive
 * @param {Object} data - Request data containing file info
 * @returns {ContentService.TextOutput} JSON response
 */
function handleFileUpload(data) {
  console.log('=== HANDLING FILE UPLOAD ===');

  try {
    const {
      fileData,
      fileName,
      fileType,
      folderId,
      menteeName = 'Unknown',
      sessionNumber = 1
    } = data;

    // Validate required fields
    if (!fileData) throw new Error('Missing fileData');
    if (!fileName) throw new Error('Missing fileName');
    if (!folderId) throw new Error('Missing folderId');

    console.log('File:', fileName);
    console.log('Mentee:', menteeName);
    console.log('Session:', sessionNumber);
    console.log('Folder ID:', folderId);

    // Determine target folder (use session subfolder if applicable)
    const executionId = `upload_${Date.now()}`;
    const targetFolderId = ensureBangkitSessionSubfolder(folderId, sessionNumber, executionId);
    console.log('Target folder ID:', targetFolderId);

    // Create safe filename
    const safeMenteeName = String(menteeName).replace(/[^a-z0-9]/gi, '_');
    const newFileName = `${safeMenteeName}_Sesi${sessionNumber}_${fileName}`;
    console.log('New filename:', newFileName);

    // Create blob and upload to Drive
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileData),
      fileType,
      newFileName
    );
    const file = DriveApp.getFolderById(targetFolderId).createFile(blob);
    const fileUrl = file.getUrl();

    console.log('File uploaded successfully:', fileUrl);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      fileName: file.getName(),
      url: fileUrl
    }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error('File upload error:', err.toString());
    throw err;
  }
}

/***** ================== AUTOMATION CORE ================== *****/

/**
 * Processes a single row to generate a document
 * Uses ScriptLock to prevent concurrent processing
 *
 * @param {number} rowNumber - Row number to process (1-indexed)
 * @returns {Object} Processing result
 */
function processSingleRow(rowNumber) {
  console.log(`=== PROCESSING ROW ${rowNumber} ===`);

  // Acquire lock to prevent concurrent processing
  const lock = LockService.getScriptLock();
  const lockAcquired = lock.tryLock(30000); // 30 second timeout

  if (!lockAcquired) {
    console.error('Could not acquire lock - another process is running');
    return {
      success: false,
      error: 'Could not acquire lock',
      rowNumber: rowNumber
    };
  }

  try {
    // Open sheet and get data
    const { sheet, headers, idx } = openBangkitSheet_();
    console.log('Sheet opened successfully');

    // Check if row is already processed
    const status = sheet.getRange(rowNumber, idx[H.Status]).getValue();
    if (status && String(status).toUpperCase().startsWith('DONE')) {
      console.log('Row already processed, skipping');
      return {
        success: true,
        skipped: true,
        reason: 'Already processed',
        rowNumber: rowNumber
      };
    }

    // Process the row
    processRowByIndex_(sheet, headers, idx, rowNumber);

    console.log('Row processed successfully');
    return {
      success: true,
      processed: true,
      rowNumber: rowNumber
    };

  } catch (err) {
    console.error('Processing error:', err.toString());
    console.error('Stack:', err.stack);

    return {
      success: false,
      error: err.toString(),
      rowNumber: rowNumber
    };

  } finally {
    // Always release lock
    lock.releaseLock();
    console.log('Lock released');
  }
}

/**
 * Main processing function for a single row
 * Reads data from sheet, generates document, updates sheet
 *
 * @param {Sheet} sheet - Google Sheets object
 * @param {Array} headers - Header row array
 * @param {Object} idx - Column index mapping
 * @param {number} r - Row number to process
 */
function processRowByIndex_(sheet, headers, idx, r) {
  console.log(`=== PROCESSING ROW INDEX ${r} ===`);

  // Step 1: Build row data object
  console.log('Step 1: Building row data...');
  const row = {};
  for (let c = 1; c <= headers.length; c++) {
    const header = headers[c - 1];
    if (header) {
      row[header] = sheet.getRange(r, c).getValue();
    }
  }
  console.log('Row data built successfully');

  // Step 2: Get mentee information
  console.log('Step 2: Getting mentee info...');
  const mentee = String(row[H.NamaUsahawan] || '').trim();
  if (!mentee) {
    throw new Error('Nama Usahawan is empty');
  }
  console.log('Mentee:', mentee);

  // Step 3: Lookup mapping data
  console.log('Step 3: Looking up mapping...');
  const map = lookupMappingByMentee_(mentee);
  if (!map || !map[M.FolderId]) {
    throw new Error(`Folder_ID not found for mentee: ${mentee}`);
  }
  console.log('Mapping found successfully');

  // Step 4: Determine session info
  console.log('Step 4: Determining session info...');
  const sesiText = String(row[H.SesiLaporan] || '');
  const sesiNum = getSessionNumberFromText_(sesiText);
  const isSesi1 = sesiNum === 1;
  const templateId = isSesi1 ? TEMPLATE_ID_SESI_1 : TEMPLATE_ID_SESI_2_4;
  console.log('Session:', sesiNum, '| Is Sesi 1:', isSesi1);
  console.log('Template ID:', templateId);

  // Step 4.5: Validate Inisiatif data (all 3 fields required for each initiative)
  console.log('Step 4.5: Validating Inisiatif data...');
  validateInisiatifData_(row);
  console.log('Inisiatif validation passed');

  // Step 5: Determine target folder (main or session subfolder)
  console.log('Step 5: Determining target folder...');
  const executionId = `doc_${r}_${Date.now()}`;
  const targetFolderId = ensureBangkitSessionSubfolder(map[M.FolderId], sesiNum, executionId);
  console.log('Target folder ID:', targetFolderId);

  // Step 6: Create document from template
  console.log('Step 6: Creating document...');
  const timestamp = Utilities.formatDate(new Date(), 'GMT+8', 'yyyyMMdd_HHmmss');
  const mentorName = String(row[H.NamaMentor] || map[M.Mentor] || 'Mentor');
  const fileName = `${mentorName}_${mentee}_Sesi${sesiNum}_${timestamp}`;
  console.log('Document name:', fileName);

  const copy = DriveApp.getFileById(templateId).makeCopy(
    fileName,
    DriveApp.getFolderById(targetFolderId)
  );
  const docId = copy.getId();
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  console.log('Document created, ID:', docId);

  // Step 7: Common text replacements
  console.log('Step 7: Performing common text replacements...');
  replaceCommonPlaceholders_(body, row, map, sesiText, sesiNum, isSesi1);
  console.log('Common replacements completed');

  // Step 8: Upward Mobility replacements (NEW)
  console.log('Step 8: Performing Upward Mobility replacements...');
  replaceUpwardMobilityPlaceholders_(body, row);
  console.log('UM replacements completed');

  // Step 9: Session-specific processing
  if (isSesi1) {
    console.log('Step 9: Processing Sesi 1 specific content...');
    processSesi1Content_(body, row, mentee, sesiNum);
  } else {
    console.log('Step 9: Processing Sesi 2+ specific content...');
    processSesi2PlusContent_(body, row, mentee, sesiNum);
  }

  // Step 10: Footer replacement
  console.log('Step 10: Filling footer...');
  try {
    fillFooterPreparedBy_(
      body,
      formatDate_(row[H.TarikhSesi]),
      String(row[H.NamaMentor] || map[M.Mentor] || '')
    );
  } catch (footerErr) {
    console.error('Footer error (non-fatal):', footerErr.toString());
  }

  // Step 11: Additional images
  console.log('Step 11: Inserting additional images...');
  try {
    insertImageAt_(body, '{{Link_Carta_GrowthWheel}}', row[H.LinkCartaGW]);
    insertImageAt_(body, '{{Link_Gambar_Profil}}', row[H.LinkGambarProfil]);
    insertImageAt_(body, '{{Link Gambar}}', row[H.LinkGambar]);
    insertImageAt_(body, '{{Link_Gambar_Premis}}', row[H.LinkGambarPremis]);
  } catch (imgErr) {
    console.error('Image error (non-fatal):', imgErr.toString());
  }

  // Step 12: Save document
  console.log('Step 12: Saving document...');
  doc.saveAndClose();
  console.log('Document saved successfully');

  // Step 13: Update sheet with results
  console.log('Step 13: Updating sheet...');
  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
  const statusValue = `DONE - ${Utilities.formatDate(new Date(), 'GMT+8', 'yyyy-MM-dd HH:mm:ss')}`;

  sheet.getRange(r, idx[H.DocUrl]).setValue(docUrl);
  sheet.getRange(r, idx[H.Status]).setValue(statusValue);

  console.log('Sheet updated successfully');
  console.log('Document URL:', docUrl);
  console.log('=== PROCESSING COMPLETE ===');
}

/**
 * Replace common placeholders in document body
 */
function replaceCommonPlaceholders_(body, row, map, sesiText, sesiNum, isSesi1) {
  const replacements = {
    '{{Nama Mentor}}': String(row[H.NamaMentor] || map[M.Mentor] || ''),
    '{{Nama Usahawan}}': String(row[H.NamaUsahawan] || ''),
    '{{Nama Bisnes}}': String(row[H.NamaBisnes] || map[M.NamaSyarikat] || ''),
    '{{Mentor Email}}': String(row[H.Emai] || map[M.MentorEmail] || ''),
    '{{Masa Sesi}}': formatTime_(row[H.MasaSesi]),
    '{{Sesi Laporan}}': sesiText,
    '{{Mod Sesi}}': String(row[H.ModSesi] || ''),
    '{{no Telefon}}': String(map[M.NoTelefon] || ''),
    '{{EMAIL}}': String(map[M.Email] || ''),
    '{{Alamat}}': String(map[M.Alamat] || ''),
    '{{Batch No}}': String(map[M.Batch] || ''),

    // Sales data
    '{{Jualan Jan}}': String(row[H.JualanJan] || ''),
    '{{Jualan Feb}}': String(row[H.JualanFeb] || ''),
    '{{Jualan Mac}}': String(row[H.JualanMac] || ''),
    '{{Jualan Apr}}': String(row[H.JualanApr] || ''),
    '{{Jualan Mei}}': String(row[H.JualanMei] || ''),
    '{{Jualan Jun}}': String(row[H.JualanJun] || ''),
    '{{Jualan Jul}}': String(row[H.JualanJul] || ''),
    '{{Jualan Ogos}}': String(row[H.JualanOgos] || ''),
    '{{Jualan Sep}}': String(row[H.JualanSep] || ''),
    '{{Jualan Okt}}': String(row[H.JualanOkt] || ''),
    '{{Jualan Nov}}': String(row[H.JualanNov] || ''),
    '{{Jualan Dis}}': String(row[H.JualanDis] || ''),

    // Business info
    '{{Produk/Servis}}': String(row[H.ProdukServis] || ''),
    '{{Pautan Media Sosial}}': String(row[H.PautanMediaSosial] || ''),

    // Reflection
    '{{Panduan_Pemerhatian_Mentor}}': String(row[H.PanduanPemerhatian] || ''),
    '{{Refleksi_Perasaan}}': String(row[H.RefPerasaan] || ''),
    '{{Refleksi_Skor}}': String(row[H.RefSkor] || ''),
    '{{Refleksi_Alasan_Skor}}': String(row[H.RefAlasan] || ''),
    '{{Refleksi_Eliminate}}': String(row[H.RefEliminate] || ''),
    '{{Refleksi_Raise}}': String(row[H.RefRaise] || ''),
    '{{Refleksi_Reduce}}': String(row[H.RefReduce] || ''),
    '{{Refleksi_Create}}': String(row[H.RefCreate] || ''),

    // Session content
    '{{Update Keputusan Terdahulu}}': String(row[H.Update1] || ''),
    '{{Ringkasan Sesi}}': String(row[H.RingkasanSesi] || '')
  };

  // Sesi 1 specific
  if (isSesi1) {
    replacements['{{Tarikh Sesi}}'] = formatDate_(row[H.TarikhSesi]);
  }

  // Perform all replacements
  Object.keys(replacements).forEach(placeholder => {
    const value = String(replacements[placeholder] ?? '');
    body.replaceText(escapeRegExp_(placeholder), value);
  });
}

/**
 * Replace Upward Mobility placeholders (NEW)
 * Handles backward compatibility - empty if field doesn't exist
 * Supports UPPERCASE format used in template: {{UM_FIELD_NAME_SEMASA}}
 */
function replaceUpwardMobilityPlaceholders_(body, row) {
  // Define all UM field mappings with UPPERCASE placeholders
  const umReplacements = {
    // Section 1: Engagement Status
    '{{UM_STATUS_PENGLIBATAN}}': String(row[H.UMStatusPenglibatan] || ''),
    '{{UM_STATUS}}': String(row[H.UMStatus] || ''),
    '{{UM_KRITERIA_IMPROVEMENT}}': String(row[H.UMKriteriaImprovement] || ''),

    // Section 2: BIMB Channels & Fintech
    '{{UM_AKAUN_BIMB}}': String(row[H.UMAkaunBimb] || ''),
    '{{UM_BIMB_BIZ}}': String(row[H.UMBimbBiz] || ''),
    '{{UM_AL_AWFAR}}': String(row[H.UMAlAwfar] || ''),
    '{{UM_MERCHANT_TERMINAL}}': String(row[H.UMMerchantTerminal] || ''),
    '{{UM_FASILITI_LAIN}}': String(row[H.UMFasilitiLain] || ''),
    '{{UM_MESINKIRA}}': String(row[H.UMMesinkira] || ''),

    // Section 3: Financial & Employment Metrics (SEMASA fields)
    '{{UM_PENDAPATAN_SEMASA}}': String(row[H.UMPendapatanSemasa] || ''),
    '{{UM_ULASAN_PENDAPATAN}}': String(row[H.UMUlasanPendapatan] || ''),
    '{{UM_PEKERJA_SEMASA}}': String(row[H.UMPekerjaSemasa] || ''),
    '{{UM_ULASAN_PEKERJA}}': String(row[H.UMUlasanPekerja] || ''),
    '{{UM_ASET_BUKAN_TUNAI_SEMASA}}': String(row[H.UMAsetBukanTunaiSemasa] || ''),
    '{{UM_ULASAN_ASET_BUKAN_TUNAI}}': String(row[H.UMUlasanAsetBukanTunai] || ''),
    '{{UM_ASET_TUNAI_SEMASA}}': String(row[H.UMAsetTunaiSemasa] || ''),
    '{{UM_ULASAN_ASET_TUNAI}}': String(row[H.UMUlasanAsetTunai] || ''),
    '{{UM_SIMPANAN_SEMASA}}': String(row[H.UMSimpananSemasa] || ''),
    '{{UM_ULASAN_SIMPANAN}}': String(row[H.UMUlasanSimpanan] || ''),
    '{{UM_ZAKAT_SEMASA}}': String(row[H.UMZakatSemasa] || ''),
    '{{UM_ULASAN_ZAKAT}}': String(row[H.UMUlasanZakat] || ''),

    // Section 4: Digitalization
    '{{UM_DIGITAL_SEMASA}}': String(row[H.UMDigitalSemasa] || ''),
    '{{UM_ULASAN_DIGITAL}}': String(row[H.UMUlasanDigital] || ''),

    // Section 5: Marketing
    '{{UM_MARKETING_SEMASA}}': String(row[H.UMMarketingSemasa] || ''),
    '{{UM_ULASAN_MARKETING}}': String(row[H.UMUlasanMarketing] || ''),

    // Section 6: Premises Visit
    '{{UM_TARIKH_LAWATAN_PREMIS}}': String(row[H.UMTarikhLawatanPremis] || ''),

    // Backward compatibility - lowercase versions (if any remain in old templates)
    '{{um_status_penglibatan}}': String(row[H.UMStatusPenglibatan] || ''),
    '{{status_penglibatan}}': String(row[H.UMStatusPenglibatan] || ''),
    '{{um_status}}': String(row[H.UMStatus] || ''),
    '{{akaun_bimb}}': String(row[H.UMAkaunBimb] || ''),
    '{{bimb_biz}}': String(row[H.UMBimbBiz] || ''),
    '{{pendapatan_semasa}}': String(row[H.UMPendapatanSemasa] || ''),
    '{{ulasan_pendapatan}}': String(row[H.UMUlasanPendapatan] || ''),
    '{{pekerja_semasa}}': String(row[H.UMPekerjaSemasa] || ''),
    '{{ulasan_pekerja}}': String(row[H.UMUlasanPekerja] || ''),
    '{{aset_bukan_tunai_semasa}}': String(row[H.UMAsetBukanTunaiSemasa] || ''),
    '{{ulasan_aset_bukan_tunai}}': String(row[H.UMUlasanAsetBukanTunai] || ''),
    '{{aset_tunai_semasa}}': String(row[H.UMAsetTunaiSemasa] || ''),
    '{{ulasan_aset_tunai}}': String(row[H.UMUlasanAsetTunai] || ''),
    '{{simpanan_semasa}}': String(row[H.UMSimpananSemasa] || ''),
    '{{ulasan_simpanan}}': String(row[H.UMUlasanSimpanan] || ''),
    '{{zakat_semasa}}': String(row[H.UMZakatSemasa] || ''),
    '{{ulasan_zakat}}': String(row[H.UMUlasanZakat] || ''),
    '{{digital_semasa}}': String(row[H.UMDigitalSemasa] || ''),
    '{{ulasan_digital}}': String(row[H.UMUlasanDigital] || ''),
    '{{marketing_semasa}}': String(row[H.UMMarketingSemasa] || ''),
    '{{ulasan_marketing}}': String(row[H.UMUlasanMarketing] || '')
  };

  // Perform all UM replacements
  let replacedCount = 0;
  Object.keys(umReplacements).forEach(placeholder => {
    const value = String(umReplacements[placeholder] ?? '');
    try {
      // Check if placeholder exists before replacing
      const searchResult = body.findText(escapeRegExp_(placeholder));
      if (searchResult) {
        body.replaceText(escapeRegExp_(placeholder), value);
        replacedCount++;
        console.log(`✓ Replaced: ${placeholder}`);
      }
    } catch (e) {
      console.error(`Failed to replace ${placeholder}:`, e.toString());
    }
  });

  console.log(`UM placeholders replaced: ${replacedCount} fields updated`);
}

/**
 * Process Sesi 1 specific content
 */
function processSesi1Content_(body, row, mentee, sesiNum) {
  try {
    console.log('Processing Sesi 1 business categories...');
    const businessCategories = buildBusinessCategoryContent_(row, H);

    // Replace business category placeholders
    body.replaceText('{{Konsep_Bisnes_Focus}}', businessCategories.konsepBisnes.focus || '');
    body.replaceText('{{Konsep_Bisnes_Keputusan}}', businessCategories.konsepBisnes.keputusan || '');
    body.replaceText('{{Konsep_Bisnes_Cadangan}}', businessCategories.konsepBisnes.cadangan || '');
    body.replaceText('{{Organisasi_Focus}}', businessCategories.organisasi.focus || '');
    body.replaceText('{{Organisasi_Keputusan}}', businessCategories.organisasi.keputusan || '');
    body.replaceText('{{Organisasi_Cadangan}}', businessCategories.organisasi.cadangan || '');
    body.replaceText('{{Hubungan_Pelanggan_Focus}}', businessCategories.hubunganPelanggan.focus || '');
    body.replaceText('{{Hubungan_Pelanggan_Keputusan}}', businessCategories.hubunganPelanggan.keputusan || '');
    body.replaceText('{{Hubungan_Pelanggan_Cadangan}}', businessCategories.hubunganPelanggan.cadangan || '');
    body.replaceText('{{Operasi_Focus}}', businessCategories.operasi.focus || '');
    body.replaceText('{{Operasi_Keputusan}}', businessCategories.operasi.keputusan || '');
    body.replaceText('{{Operasi_Cadangan}}', businessCategories.operasi.cadangan || '');

    console.log('Business categories filled');
  } catch (err) {
    console.error('Business category error (non-fatal):', err.toString());
  }

  try {
    console.log('Building Rumusan Sesi for Sesi 1...');
    const isuText = buildIsuUtama_(row);
    const langkah = buildLangkahKehadapan_(row);
    fillRumusanSesi2to4_(body, sesiNum, isuText, langkah);
    console.log('Rumusan filled');
  } catch (err) {
    console.error('Rumusan error (non-fatal):', err.toString());
  }

  try {
    console.log('Inserting main image for Sesi 1...');
    insertImageAt_(body, `{{Gambar Sesi ${sesiNum}}}`, row[H.LinkGambar]);
  } catch (err) {
    console.error('Image error (non-fatal):', err.toString());
  }
}

/**
 * Process Sesi 2+ specific content
 */
function processSesi2PlusContent_(body, row, mentee, sesiNum) {
  try {
    console.log('Building session history...');
    const sessionHistory = buildSessionHistory_(mentee, sesiNum, row, H);

    // Replace session history placeholders
    body.replaceText('{{Sesi1_Date}}', sessionHistory.sesi1.date || '');
    body.replaceText('{{Sesi1_Mode}}', sessionHistory.sesi1.mode || '');
    body.replaceText('{{Sesi2_Date}}', sessionHistory.sesi2.date || '');
    body.replaceText('{{Sesi2_Mode}}', sessionHistory.sesi2.mode || '');
    body.replaceText('{{Sesi3_Date}}', sessionHistory.sesi3.date || '');
    body.replaceText('{{Sesi3_Mode}}', sessionHistory.sesi3.mode || '');
    body.replaceText('{{Sesi4_Date}}', sessionHistory.sesi4.date || '');
    body.replaceText('{{Sesi4_Mode}}', sessionHistory.sesi4.mode || '');

    console.log('Session history filled');
  } catch (err) {
    console.error('Session history error (non-fatal):', err.toString());
  }

  try {
    console.log('Building Rumusan Sesi content...');

    // Fill completed sessions up to current
    for (let completedSesi = 2; completedSesi <= sesiNum; completedSesi++) {
      if (completedSesi === sesiNum) {
        // Current session
        const isuUtama = buildSessionIsuUtama_(mentee, completedSesi);
        const langkahKehadapan = buildSessionLangkahKehadapan_(row, H);
        const ringkasan = String(row[H.RingkasanSesi] || '');

        body.replaceText(`{{Sesi${completedSesi}_ISU_UTAMA}}`, isuUtama || '');
        body.replaceText(`{{Sesi${completedSesi}_LANGKAH_KEHADAPAN}}`, langkahKehadapan || '');
        body.replaceText(`{{Sesi${completedSesi}_RINGKASAN}}`, ringkasan || '');
      } else {
        // Previous completed sessions
        const isuUtama = buildSessionIsuUtama_(mentee, completedSesi);
        const langkahKehadapan = buildSessionLangkahKehadapanForPreviousSession_(mentee, completedSesi);
        const ringkasan = buildSessionRingkasanForPreviousSession_(mentee, completedSesi);

        body.replaceText(`{{Sesi${completedSesi}_ISU_UTAMA}}`, isuUtama || '');
        body.replaceText(`{{Sesi${completedSesi}_LANGKAH_KEHADAPAN}}`, langkahKehadapan || '');
        body.replaceText(`{{Sesi${completedSesi}_RINGKASAN}}`, ringkasan || '');
      }
    }

    console.log('Rumusan Sesi filled');
  } catch (err) {
    console.error('Rumusan error (non-fatal):', err.toString());
  }

  try {
    console.log('Inserting session images...');

    // Insert images for all completed sessions
    for (let completedSesi = 1; completedSesi <= sesiNum; completedSesi++) {
      if (completedSesi === sesiNum) {
        insertImageAt_(body, `{{Gambar Sesi ${completedSesi}}}`, row[H.LinkGambar]);
      } else {
        const previousImages = getSessionImagesForPreviousSession_(mentee, completedSesi);
        insertImageAt_(body, `{{Gambar Sesi ${completedSesi}}}`, previousImages);
      }
    }

    console.log('Session images inserted');
  } catch (err) {
    console.error('Session images error (non-fatal):', err.toString());
  }
}

/***** ================== HELPER FUNCTIONS ================== *****/

/**
 * Opens Bangkit sheet and returns sheet, headers, and column index
 */
function openBangkitSheet_() {
  try {
    const ss = SpreadsheetApp.openById(REPORT_SHEET_ID);
    const sheet = ss.getSheetByName(REPORT_SHEET_NAME);

    if (!sheet) {
      throw new Error(`Sheet "${REPORT_SHEET_NAME}" not found in spreadsheet ${REPORT_SHEET_ID}`);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idx = buildColumnIndex_(headers);

    return { sheet, headers, idx };
  } catch (err) {
    console.error('Failed to open Bangkit sheet:', err.toString());
    throw err;
  }
}

/**
 * Opens Mapping sheet and returns data
 */
function openMappingSheet_() {
  try {
    const ss = SpreadsheetApp.openById(MAPPING_SHEET_ID);
    const sheet = ss.getSheetByName(MAPPING_SHEET_NAME);

    if (!sheet) {
      throw new Error(`Sheet "${MAPPING_SHEET_NAME}" not found`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);

    return { sheet, data, headers };
  } catch (err) {
    console.error('Failed to open Mapping sheet:', err.toString());
    throw err;
  }
}

/**
 * Builds column index from headers array
 */
function buildColumnIndex_(headers) {
  const idx = {};
  headers.forEach((header, i) => {
    if (header) {
      idx[String(header)] = i + 1; // 1-indexed for getRange()
    }
  });
  return idx;
}

/**
 * Looks up mentee in mapping sheet
 */
function lookupMappingByMentee_(menteeName) {
  const { data, headers } = openMappingSheet_();

  const menteeColIdx = headers.indexOf(M.Mentee);
  if (menteeColIdx === -1) {
    throw new Error('Mentee column not found in Mapping sheet');
  }

  // Find matching row
  for (let i = 1; i < data.length; i++) {
    const rowMentee = String(data[i][menteeColIdx] || '').trim();
    if (rowMentee === menteeName) {
      // Build mapping object
      const mapping = {};
      headers.forEach((header, colIdx) => {
        mapping[header] = data[i][colIdx];
      });
      return mapping;
    }
  }

  throw new Error(`Mentee "${menteeName}" not found in Mapping sheet`);
}

/**
 * Extracts session number from session text
 */
function getSessionNumberFromText_(sesiText) {
  const match = String(sesiText).match(/\d+/);
  return match ? parseInt(match[0]) : 1;
}

/**
 * Ensures session subfolder exists and returns its ID
 */
function ensureBangkitSessionSubfolder(parentFolderId, sessionNumber, executionId) {
  try {
    // Validate inputs
    if (!parentFolderId) {
      console.log('No parent folder ID provided, returning empty');
      return parentFolderId;
    }

    if (sessionNumber < 1 || sessionNumber > 4) {
      console.log('Invalid session number:', sessionNumber, '- using parent folder');
      return parentFolderId;
    }

    const subfolderName = `Sesi ${sessionNumber}`;
    console.log(`[${executionId}] Ensuring subfolder exists: "${subfolderName}"`);

    const parentFolder = DriveApp.getFolderById(parentFolderId);
    const existingFolders = parentFolder.getFoldersByName(subfolderName);

    if (existingFolders.hasNext()) {
      const existingFolder = existingFolders.next();
      console.log(`[${executionId}] Subfolder already exists:`, existingFolder.getId());
      return existingFolder.getId();
    }

    // Create new subfolder
    const newFolder = parentFolder.createFolder(subfolderName);
    console.log(`[${executionId}] Created new subfolder:`, newFolder.getId());
    return newFolder.getId();

  } catch (err) {
    console.error(`[${executionId}] Subfolder error:`, err.toString());
    console.error('Falling back to parent folder');
    return parentFolderId;
  }
}

/**
 * Formats date for display
 */
function formatDate_(dateValue) {
  if (!dateValue) return '';
  try {
    if (dateValue instanceof Date) {
      return Utilities.formatDate(dateValue, 'GMT+8', 'dd/MM/yyyy');
    }
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return Utilities.formatDate(date, 'GMT+8', 'dd/MM/yyyy');
    }
    return String(dateValue);
  } catch (err) {
    return String(dateValue);
  }
}

/**
 * Formats time for display
 */
function formatTime_(timeValue) {
  if (!timeValue) return '';
  try {
    if (timeValue instanceof Date) {
      return Utilities.formatDate(timeValue, 'GMT+8', 'HH:mm');
    }
    return String(timeValue);
  } catch (err) {
    return String(timeValue);
  }
}

/**
 * Escapes special regex characters in placeholder
 */
function escapeRegExp_(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates that all Inisiatif fields are complete
 * Ensures Fokus Area, Keputusan, and Cadangan Tindakan are all filled
 * 
 * @param {Object} row - Row data object
 * @throws {Error} If any Inisiatif has incomplete data
 */
function validateInisiatifData_(row) {
  const incompleteInisiatif = [];

  // Check all 4 initiatives
  for (let i = 1; i <= 4; i++) {
    const fokus = String(row[`Fokus Area ${i}`] || '').trim();
    const keputusan = String(row[`Keputusan ${i}`] || '').trim();
    const tindakan = String(row[`Cadangan Tindakan ${i}`] || '').trim();

    // If any field is filled, all 3 must be filled
    const hasAnyData = fokus || keputusan || tindakan;
    const hasAllData = fokus && keputusan && tindakan;

    if (hasAnyData && !hasAllData) {
      // Identify which fields are missing
      const missingFields = [];
      if (!fokus) missingFields.push('Fokus Area');
      if (!keputusan) missingFields.push('Keputusan');
      if (!tindakan) missingFields.push('Cadangan Tindakan');

      incompleteInisiatif.push({
        number: i,
        missing: missingFields
      });
    }
  }

  // Throw error if any incomplete initiatives found
  if (incompleteInisiatif.length > 0) {
    const errorDetails = incompleteInisiatif.map(item => 
      `Inisiatif ${item.number}: Missing ${item.missing.join(', ')}`
    ).join('; ');
    
    throw new Error(
      `Incomplete Inisiatif data. All 3 fields (Fokus Area, Keputusan, Cadangan Tindakan) must be filled for each initiative. ` +
      `Problems found: ${errorDetails}`
    );
  }
}

/**
 * Builds business category content from focus areas
 * Maps focus areas to 4 business categories
 */
function buildBusinessCategoryContent_(row, headers) {
  const categories = {
    konsepBisnes: { focus: [], keputusan: [], cadangan: [] },
    organisasi: { focus: [], keputusan: [], cadangan: [] },
    hubunganPelanggan: { focus: [], keputusan: [], cadangan: [] },
    operasi: { focus: [], keputusan: [], cadangan: [] }
  };

  // Category mapping
  const categoryMap = {
    'Konsep Bisnes': 'konsepBisnes',
    'Business Idea': 'konsepBisnes',
    'Product Portfolio': 'konsepBisnes',
    'Value Proposition': 'konsepBisnes',

    'Organisasi': 'organisasi',
    'Employees': 'organisasi',
    'Partners & Resources': 'organisasi',
    'Management': 'organisasi',

    'Hubungan Pelanggan': 'hubunganPelanggan',
    'Marketing': 'hubunganPelanggan',
    'Sales': 'hubunganPelanggan',
    'Customer Relations': 'hubunganPelanggan',

    'Operasi': 'operasi',
    'Business Process': 'operasi',
    'Financial': 'operasi',
    'Delivery': 'operasi'
  };

  // Process all 4 focus areas
  // Note: Validation ensures if any field exists, all 3 fields (Fokus, Keputusan, Tindakan) exist
  for (let i = 1; i <= 4; i++) {
    // Use header values from H constant to access row data
    const fokusHeaderValue = headers[`Fokus${i}`];      // 'Fokus Area 1', etc.
    const keputusanHeaderValue = headers[`Keputusan${i}`]; // 'Keputusan 1', etc.
    const tindakanHeaderValue = headers[`Tindakan${i}`]; // 'Cadangan Tindakan 1', etc.

    const fokusArea = String(row[fokusHeaderValue] || '').trim();
    const keputusan = String(row[keputusanHeaderValue] || '').trim();
    const cadangan = String(row[tindakanHeaderValue] || '').trim();

    // Skip empty initiatives (validation ensures if one field exists, all exist)
    if (!fokusArea) continue;

    // Find matching category based on Fokus Area
    let categoryKey = null;
    for (const [pattern, key] of Object.entries(categoryMap)) {
      if (fokusArea.toLowerCase().includes(pattern.toLowerCase())) {
        categoryKey = key;
        break;
      }
    }

    // Use default category if no match found (fallback to konsepBisnes)
    if (!categoryKey) {
      categoryKey = 'konsepBisnes';
      console.log(`Inisiatif ${i}: No category match for "${fokusArea}", defaulting to Konsep Bisnes`);
    }

    // Add to category (all 3 fields guaranteed to exist by validation)
    categories[categoryKey].focus.push(fokusArea);
    categories[categoryKey].keputusan.push(keputusan);
    categories[categoryKey].cadangan.push(cadangan);
    
    console.log(`Inisiatif ${i}: Added to ${categoryKey} - Fokus: "${fokusArea}", Keputusan: "${keputusan}", Cadangan: "${cadangan}"`);
  }

  // Join arrays into strings
  Object.keys(categories).forEach(key => {
    categories[key].focus = categories[key].focus.join('\n');
    categories[key].keputusan = categories[key].keputusan.join('\n');
    categories[key].cadangan = categories[key].cadangan.join('\n');
  });

  // Log final results
  console.log('Business categories built:');
  Object.keys(categories).forEach(key => {
    if (categories[key].focus || categories[key].keputusan || categories[key].cadangan) {
      console.log(`  ${key}: Focus=${categories[key].focus.length} chars, Keputusan=${categories[key].keputusan.length} chars, Cadangan=${categories[key].cadangan.length} chars`);
    }
  });

  return categories;
}

/**
 * Builds ISU UTAMA from current row's focus areas
 */
function buildIsuUtama_(row) {
  const issues = [];
  for (let i = 1; i <= 4; i++) {
    const fokus = String(row[`Fokus Area ${i}`] || '').trim();
    const keputusan = String(row[`Keputusan ${i}`] || '').trim();
    if (fokus || keputusan) {
      issues.push(`${fokus}: ${keputusan}`);
    }
  }
  return issues.join('\n');
}

/**
 * Builds LANGKAH KEHADAPAN from current row's action plans
 */
function buildLangkahKehadapan_(row) {
  const actions = [];
  for (let i = 1; i <= 4; i++) {
    const tindakan = String(row[`Cadangan Tindakan ${i}`] || '').trim();
    if (tindakan) {
      actions.push(`${i}. ${tindakan}`);
    }
  }
  return actions.join('\n');
}

/**
 * Builds session history for Sesi 2+
 */
function buildSessionHistory_(mentee, currentSesi, currentRow, headers) {
  const history = {
    sesi1: { date: '', mode: '' },
    sesi2: { date: '', mode: '' },
    sesi3: { date: '', mode: '' },
    sesi4: { date: '', mode: '' }
  };

  try {
    const { sheet } = openBangkitSheet_();
    const data = sheet.getDataRange().getValues();
    const sheetHeaders = data[0];

    const usahawanIdx = sheetHeaders.indexOf(headers.NamaUsahawan);
    const sesiIdx = sheetHeaders.indexOf(headers.SesiLaporan);
    const tarikhIdx = sheetHeaders.indexOf(headers.TarikhSesi);
    const modIdx = sheetHeaders.indexOf(headers.ModSesi);

    // Find previous sessions
    for (let i = 1; i < data.length; i++) {
      const rowMentee = String(data[i][usahawanIdx] || '').trim();
      if (rowMentee === mentee) {
        const sesiText = String(data[i][sesiIdx] || '');
        const sesiNum = getSessionNumberFromText_(sesiText);

        if (sesiNum >= 1 && sesiNum <= 4 && sesiNum < currentSesi) {
          history[`sesi${sesiNum}`].date = formatDate_(data[i][tarikhIdx]);
          history[`sesi${sesiNum}`].mode = String(data[i][modIdx] || '');
        }
      }
    }

    // Current session
    if (currentSesi >= 1 && currentSesi <= 4) {
      history[`sesi${currentSesi}`].date = formatDate_(currentRow[headers.TarikhSesi]);
      history[`sesi${currentSesi}`].mode = String(currentRow[headers.ModSesi] || '');
    }

  } catch (err) {
    console.error('Session history error:', err.toString());
  }

  return history;
}

/**
 * Builds ISU UTAMA for specific previous session
 */
function buildSessionIsuUtama_(mentee, sesiNum) {
  if (sesiNum <= 1) return '';

  const previousSesi = sesiNum - 1;

  try {
    const { sheet } = openBangkitSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const usahawanIdx = headers.indexOf(H.NamaUsahawan);
    const sesiIdx = headers.indexOf(H.SesiLaporan);

    // Find previous session row
    for (let i = 1; i < data.length; i++) {
      const rowMentee = String(data[i][usahawanIdx] || '').trim();
      const rowSesiNum = getSessionNumberFromText_(String(data[i][sesiIdx] || ''));

      if (rowMentee === mentee && rowSesiNum === previousSesi) {
        const issues = [];
        for (let j = 1; j <= 4; j++) {
          const fokusIdx = headers.indexOf(`Fokus Area ${j}`);
          const keputusanIdx = headers.indexOf(`Keputusan ${j}`);
          const fokus = String(data[i][fokusIdx] || '').trim();
          const keputusan = String(data[i][keputusanIdx] || '').trim();
          if (fokus || keputusan) {
            issues.push(`${fokus}: ${keputusan}`);
          }
        }
        return issues.join('\n');
      }
    }
  } catch (err) {
    console.error('ISU UTAMA error:', err.toString());
  }

  return '';
}

/**
 * Builds LANGKAH KEHADAPAN for current session
 */
function buildSessionLangkahKehadapan_(row, headers) {
  const actions = [];
  for (let i = 1; i <= 4; i++) {
    const tindakan = String(row[headers[`Tindakan${i}`]] || '').trim();
    if (tindakan) {
      actions.push(`${i}. ${tindakan}`);
    }
  }
  return actions.join('\n');
}

/**
 * Builds LANGKAH KEHADAPAN for previous session
 */
function buildSessionLangkahKehadapanForPreviousSession_(mentee, sesiNum) {
  try {
    const { sheet } = openBangkitSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const usahawanIdx = headers.indexOf(H.NamaUsahawan);
    const sesiIdx = headers.indexOf(H.SesiLaporan);

    for (let i = 1; i < data.length; i++) {
      const rowMentee = String(data[i][usahawanIdx] || '').trim();
      const rowSesiNum = getSessionNumberFromText_(String(data[i][sesiIdx] || ''));

      if (rowMentee === mentee && rowSesiNum === sesiNum) {
        const actions = [];
        for (let j = 1; j <= 4; j++) {
          const tindakanIdx = headers.indexOf(`Cadangan Tindakan ${j}`);
          const tindakan = String(data[i][tindakanIdx] || '').trim();
          if (tindakan) {
            actions.push(`${j}. ${tindakan}`);
          }
        }
        return actions.join('\n');
      }
    }
  } catch (err) {
    console.error('LANGKAH KEHADAPAN error:', err.toString());
  }

  return '';
}

/**
 * Builds RINGKASAN for previous session
 */
function buildSessionRingkasanForPreviousSession_(mentee, sesiNum) {
  try {
    const { sheet } = openBangkitSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const usahawanIdx = headers.indexOf(H.NamaUsahawan);
    const sesiIdx = headers.indexOf(H.SesiLaporan);
    const ringkasanIdx = headers.indexOf(H.RingkasanSesi);

    for (let i = 1; i < data.length; i++) {
      const rowMentee = String(data[i][usahawanIdx] || '').trim();
      const rowSesiNum = getSessionNumberFromText_(String(data[i][sesiIdx] || ''));

      if (rowMentee === mentee && rowSesiNum === sesiNum) {
        return String(data[i][ringkasanIdx] || '');
      }
    }
  } catch (err) {
    console.error('RINGKASAN error:', err.toString());
  }

  return '';
}

/**
 * Gets session images for previous session
 */
function getSessionImagesForPreviousSession_(mentee, sesiNum) {
  try {
    const { sheet } = openBangkitSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const usahawanIdx = headers.indexOf(H.NamaUsahawan);
    const sesiIdx = headers.indexOf(H.SesiLaporan);
    const gambarIdx = headers.indexOf(H.LinkGambar);

    for (let i = 1; i < data.length; i++) {
      const rowMentee = String(data[i][usahawanIdx] || '').trim();
      const rowSesiNum = getSessionNumberFromText_(String(data[i][sesiIdx] || ''));

      if (rowMentee === mentee && rowSesiNum === sesiNum) {
        return data[i][gambarIdx] || '';
      }
    }
  } catch (err) {
    console.error('Session images error:', err.toString());
  }

  return '';
}

/**
 * Fills Rumusan Sesi 2-4 section
 */
function fillRumusanSesi2to4_(body, sesiNum, isuUtama, langkahKehadapan) {
  try {
    body.replaceText(`{{Sesi${sesiNum}_ISU_UTAMA}}`, isuUtama || '');
    body.replaceText(`{{Sesi${sesiNum}_LANGKAH_KEHADAPAN}}`, langkahKehadapan || '');
  } catch (err) {
    console.error('Rumusan fill error:', err.toString());
  }
}

/**
 * Fills footer with prepared by info
 */
function fillFooterPreparedBy_(body, date, mentorName) {
  try {
    const doc = body.getParent();
    const footer = doc.getFooter();
    if (!footer) {
      console.log('No footer found in template - skipping footer replacement');
      return;
    }

    footer.replaceText('{{Tarikh}}', date || '');
    footer.replaceText('{{Nama Mentor}}', mentorName || '');
    console.log('Footer updated successfully');
  } catch (err) {
    console.error('Footer fill error:', err.toString());
  }
}

/**
 * Extracts Drive file ID from various URL formats
 */
/**
 * Extracts Google Drive file ID from various URL formats
 * Supports multiple Drive URL patterns
 * 
 * @param {string} url - Google Drive URL or file ID
 * @returns {string} Drive file ID or empty string
 */
function extractDriveFileId_(url) {
  if (!url) return '';
  
  // Pattern 1: /file/d/FILE_ID/
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})\b/);
  if (m1) return m1[1];
  
  // Pattern 2: ?id=FILE_ID or &id=FILE_ID
  const m2 = url.match(/[?&](?:id|fileId)=([a-zA-Z0-9_-]{20,})\b/);
  if (m2) return m2[1];
  
  // Pattern 3: Plain file ID (20+ alphanumeric chars)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  
  // Pattern 4: /open?id=FILE_ID or /uc?id=FILE_ID
  const m3 = url.match(/(?:open|uc)\?id=([a-zA-Z0-9_-]{20,})\b/);
  if (m3) return m3[1];
  
  return '';
}

/**
 * Clamps image width to maximum while maintaining aspect ratio
 * Only shrinks images, never enlarges them
 * 
 * @param {InlineImage} img - Google Docs InlineImage object
 * @param {number} maxWidth - Maximum width in pixels
 */
function clampImageWidth_(img, maxWidth) {
  try {
    const originalWidth = img.getWidth();
    const originalHeight = img.getHeight();
    
    // Only shrink if image is wider than max
    if (originalWidth > maxWidth) {
      const aspectRatio = originalHeight / originalWidth;
      const newHeight = maxWidth * aspectRatio;
      img.setWidth(maxWidth).setHeight(newHeight);
    }
  } catch (e) {
    console.error('Error clamping image width:', e.toString());
  }
}

/**
 * Finds ancestor table cell for an element
 * Used to detect if placeholder is inside a table
 * 
 * @param {Element} el - Document element
 * @returns {TableCell|null} Table cell or null if not in table
 */
function findAncestorTableCell_(el) {
  let cur = el;
  while (cur) {
    if (cur.getType && cur.getType() === DocumentApp.ElementType.TABLE_CELL) {
      return cur.asTableCell();
    }
    if (!cur.getParent) break;
    cur = cur.getParent();
  }
  return null;
}

/**
 * Replaces all occurrences of marker text in document body
 * 
 * @param {Body} body - Document body
 * @param {string} marker - Text marker to replace
 * @param {string} text - Replacement text
 */
function replaceAll_(body, marker, text) {
  let range;
  while ((range = body.findText(marker))) {
    range.getElement().asText().replaceText(marker, text);
  }
}

/**
 * ROBUST IMAGE INSERTION - Adapted from Script A
 * 
 * Inserts images at placeholder with superior handling:
 * - Proportional resizing (never distorts)
 * - Table-aware 2-column layout
 * - Visible error placeholders (not silent failures)
 * - Supports JSON arrays + comma-separated URLs
 * 
 * @param {Body} body - Document body
 * @param {string} marker - Placeholder marker (e.g., "{{Gambar Sesi 1}}")
 * @param {string|Array} urls - Image URL(s) - JSON array or comma-separated
 */
function insertImageAt_(body, marker, urls) {
  // Handle empty/null URLs - remove placeholder
  if (!urls) {
    replaceAll_(body, marker, '');
    return;
  }

  let list = [];

  // Parse URLs - try JSON first, fallback to comma-split
  try {
    const parsed = JSON.parse(String(urls));
    if (Array.isArray(parsed)) {
      console.log(`[insertImageAt_] Parsed ${parsed.length} URLs from JSON array for marker "${marker}"`);
      list = parsed.map(s => String(s).trim()).filter(Boolean);
    } else {
      throw new Error('Parsed value is not an array');
    }
  } catch (jsonError) {
    // Fallback: comma-separated format (legacy)
    console.log(`[insertImageAt_] Using comma-split format for marker "${marker}"`);
    list = String(urls).split(',').map(s => s.trim()).filter(Boolean);
  }

  console.log(`[insertImageAt_] Inserting ${list.length} images for marker "${marker}"`);

  // Find placeholder in document
  const range = body.findText(marker);
  if (!range) {
    console.log(`[insertImageAt_] Marker "${marker}" not found in document`);
    return;
  }

  // Clear placeholder text
  const el = range.getElement();
  el.asText().replaceText(marker, '');
  let par = el.getParent().asParagraph();

  // Detect if we're inside a table cell
  const cell = findAncestorTableCell_(par);
  const inCell = !!cell;

  // Layout constants
  const MAX_BODY_WIDTH = 450;   // Full-width image size
  const MAX_CELL_WIDTH = 220;   // Cell image size
  const COLS_PER_ROW = 2;       // 2-column grid in tables

  if (inCell) {
    // TABLE CELL MODE: 2-column grid layout
    par.clear();
    let inRow = 0;

    list.forEach((url, i) => {
      try {
        // Fetch image blob
        const fileId = extractDriveFileId_(url);
        const blob = fileId 
          ? DriveApp.getFileById(fileId).getBlob() 
          : UrlFetchApp.fetch(url).getBlob();

        // Create new paragraph for new row
        if (inRow === 0 && i > 0) {
          par = cell.appendParagraph('');
        }

        // Insert image with proportional sizing
        const img = par.appendInlineImage(blob);
        clampImageWidth_(img, MAX_CELL_WIDTH);

        inRow++;

        // Add spacing between columns (not after last column)
        if (inRow < COLS_PER_ROW) {
          par.appendText('  ');
        }

        // Reset row counter after 2 columns
        if (inRow === COLS_PER_ROW) {
          inRow = 0;
        }

      } catch (e) {
        // VISIBLE ERROR: Show placeholder instead of silent failure
        par.appendText(` [[Image not available: ${url}]] `);
        console.error(`[insertImageAt_] Failed to insert image ${i + 1}:`, e.toString());
      }
    });

  } else {
    // BODY MODE: Single-row horizontal layout
    list.forEach((url, i) => {
      try {
        // Fetch image blob
        const fileId = extractDriveFileId_(url);
        const blob = fileId 
          ? DriveApp.getFileById(fileId).getBlob() 
          : UrlFetchApp.fetch(url).getBlob();

        // Insert image with proportional sizing
        const img = par.appendInlineImage(blob);
        clampImageWidth_(img, MAX_BODY_WIDTH);

        // Add spacing between images (not after last one)
        if (i < list.length - 1) {
          par.appendText(' ');
        }

      } catch (e) {
        // VISIBLE ERROR: Show placeholder instead of silent failure
        par.appendText(` [[Image not available: ${url}]] `);
        console.error(`[insertImageAt_] Failed to insert image ${i + 1}:`, e.toString());
      }
    });
  }
}

/***** ================== TIME-DRIVEN TRIGGER ================== *****/

/**
 * Processes unprocessed rows automatically
 * Called by time-driven trigger (every 1 minute)
 */
function processUnprocessedRows() {
  console.log('=== TIME-DRIVEN TRIGGER STARTED ===');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.log('Could not acquire lock - another process is running');
    return;
  }

  try {
    const { sheet, headers, idx } = openBangkitSheet_();
    const lastRow = sheet.getLastRow();

    console.log('Scanning rows 2 to', lastRow);

    // Find first unprocessed row
    for (let r = 2; r <= lastRow; r++) {
      const docUrl = sheet.getRange(r, idx[H.DocUrl]).getValue();
      const status = sheet.getRange(r, idx[H.Status]).getValue();

      // Skip if already processed
      if (docUrl || (status && String(status).toUpperCase().startsWith('DONE'))) {
        continue;
      }

      console.log('Found unprocessed row:', r);

      // Process this row
      try {
        processRowByIndex_(sheet, headers, idx, r);
        console.log('Row', r, 'processed successfully');
        break; // Process only ONE row per trigger execution
      } catch (rowErr) {
        console.error('Failed to process row', r, ':', rowErr.toString());
        // Mark as error
        sheet.getRange(r, idx[H.Status]).setValue(`ERROR - ${rowErr.toString().substring(0, 100)}`);
        break;
      }
    }

    console.log('=== TIME-DRIVEN TRIGGER COMPLETE ===');

  } catch (err) {
    console.error('Trigger error:', err.toString());
  } finally {
    lock.releaseLock();
  }
}

/***** ================== TESTING FUNCTIONS ================== *****/

/**
 * Test function: Process specific row
 * Usage: testProcessSingleRow(5)
 */
function testProcessSingleRow(rowNumber) {
  console.log('=== TESTING ROW', rowNumber, '===');
  const result = processSingleRow(rowNumber || 2);
  console.log('Result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Test function: Verify column mapping
 */
function testColumnMapping() {
  console.log('=== TESTING COLUMN MAPPING ===');

  const { sheet, headers, idx } = openBangkitSheet_();

  console.log('Total headers:', headers.length);
  console.log('\nFirst 10 headers:');
  headers.slice(0, 10).forEach((h, i) => {
    console.log(`  ${i}: ${h}`);
  });

  console.log('\nUpward Mobility headers (54-81):');
  const umHeaders = [
    'UM_STATUS_PENGLIBATAN', 'UM_STATUS', 'UM_KRITERIA_IMPROVEMENT',
    'UM_AKAUN_BIMB', 'UM_BIMB_BIZ', 'UM_AL_AWFAR',
    'UM_MERCHANT_TERMINAL', 'UM_FASILITI_LAIN', 'UM_MESINKIRA',
    'UM_PENDAPATAN_SEMASA', 'UM_ULASAN_PENDAPATAN'
  ];

  umHeaders.forEach(h => {
    const col = idx[h];
    console.log(`  ${h}: Column ${col}`);
  });

  console.log('\n=== COLUMN MAPPING TEST COMPLETE ===');
}

/**
 * Test function: Business category mapping
 */
function testBusinessCategoryMapping() {
  console.log('=== TESTING BUSINESS CATEGORY MAPPING ===');

  const testRow = {
    [H.Fokus1]: 'Konsep Bisnes',
    [H.Keputusan1]: 'Develop new product',
    [H.Fokus2]: 'Organisasi',
    [H.Keputusan2]: 'Hire staff',
    [H.Fokus3]: 'Marketing',
    [H.Keputusan3]: 'Launch campaign',
    [H.Fokus4]: 'Financial',
    [H.Keputusan4]: 'Improve cash flow'
  };

  const result = buildBusinessCategoryContent_(testRow, H);

  console.log('\nKonsep Bisnes:');
  console.log('  Focus:', result.konsepBisnes.focus);
  console.log('  Keputusan:', result.konsepBisnes.keputusan);

  console.log('\nOrganisasi:');
  console.log('  Focus:', result.organisasi.focus);
  console.log('  Keputusan:', result.organisasi.keputusan);

  console.log('\nHubungan Pelanggan:');
  console.log('  Focus:', result.hubunganPelanggan.focus);
  console.log('  Keputusan:', result.hubunganPelanggan.keputusan);

  console.log('\nOperasi:');
  console.log('  Focus:', result.operasi.focus);
  console.log('  Keputusan:', result.operasi.keputusan);

  console.log('\n=== BUSINESS CATEGORY TEST COMPLETE ===');
}

/**
 * Setup time-driven trigger (run once)
 */
function setupTimeDrivenTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processUnprocessedRows') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger (every 1 minute)
  ScriptApp.newTrigger('processUnprocessedRows')
    .timeBased()
    .everyMinutes(1)
    .create();

  console.log('Time-driven trigger created successfully');
}

/**
 * Test doPost with processRow action
 */
function testDoPostProcessRow() {
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'processRow',
        rowNumber: 2
      })
    }
  };

  const response = doPost(testEvent);
  const result = JSON.parse(response.getContent());
  console.log('doPost result:', JSON.stringify(result, null, 2));
}
