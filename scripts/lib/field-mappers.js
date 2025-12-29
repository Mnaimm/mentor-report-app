// scripts/lib/field-mappers.js
// Field mapping and parsing utilities for Bangkit reports sync

/**
 * Parse session number from string like "Sesi #1" or "#2"
 * @param {string} sessionStr - Session string from sheet
 * @returns {number} Session number (1, 2, 3, etc.)
 */
function parseSessionNumber(sessionStr) {
  if (!sessionStr) return null;
  const match = sessionStr.match(/#?(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse initiatives from row (4 initiatives, 3 columns each)
 * Columns 12-23: Fokus Area, Keputusan, Cadangan Tindakan (x4)
 * @param {Array} row - Sheet row data
 * @returns {Array} Array of initiative objects
 */
function parseInisiatif(row) {
  const initiatives = [];
  const startCol = 12; // Column M (index 12)

  for (let i = 0; i < 4; i++) {
    const baseIndex = startCol + (i * 3);
    const focusArea = row[baseIndex] || '';
    const keputusan = row[baseIndex + 1] || '';
    const pelanTindakan = row[baseIndex + 2] || '';

    // Only add if at least one field has data
    if (focusArea || keputusan || pelanTindakan) {
      initiatives.push({
        focusArea,
        keputusan,
        pelanTindakan
      });
    }
  }

  return initiatives.length > 0 ? initiatives : null;
}

/**
 * Parse 12-month sales data
 * Columns 24-35: Jan through Dec
 * @param {Array} row - Sheet row data
 * @returns {Array} Array of 12 numbers (or null if all empty)
 */
function parseJualanTerkini(row) {
  const sales = [];
  const startCol = 24; // Column Y (index 24)

  for (let i = 0; i < 12; i++) {
    const value = row[startCol + i];
    // Convert to number, default to 0 if empty or invalid
    sales.push(value ? parseFloat(value) || 0 : 0);
  }

  // Return null if all zeros
  const hasData = sales.some(s => s > 0);
  return hasData ? sales : null;
}

/**
 * Parse reflection data (only for session 1)
 * Columns 41-48: Various reflection fields
 * @param {Array} row - Sheet row data
 * @param {number} sessionNumber - Session number
 * @returns {Object|null} Reflection object or null
 */
function parseRefleksi(row, sessionNumber) {
  // Only parse reflections for session 1
  if (sessionNumber !== 1) return null;

  const refleksi = {
    panduan_pemerhatian: row[41] || null,
    perasaan: row[42] || null,
    skor: row[43] ? parseInt(row[43], 10) : null,
    alasan_skor: row[44] || null,
    eliminate: row[45] || null,
    raise: row[46] || null,
    reduce: row[47] || null,
    create: row[48] || null
  };

  // Only return if at least one field has data
  const hasData = Object.values(refleksi).some(v => v !== null);
  return hasData ? refleksi : null;
}

/**
 * Parse GrowthWheel scores
 * Columns 54+: GW_Skor_1, GW_Skor_2, etc.
 * @param {Array} row - Sheet row data
 * @returns {Array|null} Array of scores or null
 */
function parseGWSkor(row) {
  const scores = [];
  const startCol = 54; // Column BC (index 54)

  // Parse all available GW score columns
  for (let i = 0; i < 20; i++) { // Max 20 scores
    const value = row[startCol + i];
    if (value !== undefined && value !== '') {
      scores.push(parseFloat(value) || 0);
    } else if (scores.length > 0) {
      // Stop at first empty column after we've started collecting scores
      break;
    }
  }

  return scores.length > 0 ? scores : null;
}

/**
 * Parse and build image URLs object
 * @param {Array} row - Sheet row data
 * @returns {Object} Image URLs object
 */
function parseImageURLs(row) {
  const imageURLs = {};

  // Link Gambar (column 36) - may be JSON array string
  const linkGambar = row[36];
  if (linkGambar) {
    try {
      // Try parsing as JSON array first
      const parsed = JSON.parse(linkGambar);
      imageURLs.sesi = Array.isArray(parsed) ? parsed : [linkGambar];
    } catch {
      // If not JSON, treat as single URL
      imageURLs.sesi = [linkGambar];
    }
  }

  // Link Gambar Premis (column 50) - may be JSON array string
  const linkPremis = row[50];
  if (linkPremis) {
    try {
      const parsed = JSON.parse(linkPremis);
      imageURLs.premis = Array.isArray(parsed) ? parsed : [linkPremis];
    } catch {
      imageURLs.premis = [linkPremis];
    }
  }

  // GrowthWheel chart (column 39) - single URL
  if (row[39]) {
    imageURLs.growthwheel = row[39];
  }

  // Profile image (column 49) - single URL
  if (row[49]) {
    imageURLs.profil = row[49];
  }

  return Object.keys(imageURLs).length > 0 ? imageURLs : null;
}

/**
 * Parse boolean checkbox value
 * @param {string} value - Checkbox value from sheet
 * @returns {boolean} True if checked
 */
function parseCheckbox(value) {
  if (!value) return false;
  const lowerValue = value.toString().toLowerCase();
  return lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1' || lowerValue === 'checked';
}

/**
 * Map complete V8 row to Bangkit report object
 * @param {Array} row - Sheet row data
 * @param {number} rowNumber - Row number in sheet (1-indexed)
 * @param {Object} resolvedEntities - {entrepreneur_id, mentor_id, session_id, folder_id}
 * @returns {Object} Report object ready for Supabase
 */
function mapBangkitRow(row, rowNumber, resolvedEntities) {
  const sessionNumber = parseSessionNumber(row[3]);
  const miaStatus = row[2] || 'Selesai';
  const isMIA = miaStatus.toLowerCase().includes('mia');

  return {
    // Foreign keys
    session_id: resolvedEntities.session_id,
    mentor_id: resolvedEntities.mentor_id,
    entrepreneur_id: resolvedEntities.entrepreneur_id,
    folder_id: resolvedEntities.folder_id || null,

    // Program and session info
    program: 'Bangkit',
    session_number: sessionNumber,
    session_date: row[4] || null,
    status: 'submitted',
    mia_status: miaStatus,
    mia_proof_url: isMIA ? (row[40] || null) : null,

    // Denormalized names (historical record)
    nama_usahawan: row[7] || null,
    nama_syarikat: row[8] || null,
    nama_bisnes: row[8] || null, // Alias
    nama_mentor: row[9] || null,
    mentor_email: row[1] || null,

    // Session details
    mod_sesi: row[6] || null,
    masa_mula: row[5] || null,
    rumusan: row[11] || null,
    kemaskini_inisiatif: row[10] || null,

    // JSONB fields
    inisiatif: parseInisiatif(row),
    jualan_terkini: parseJualanTerkini(row),
    refleksi: parseRefleksi(row, sessionNumber),
    gw_skor: parseGWSkor(row),
    image_urls: parseImageURLs(row),

    // Other fields
    produk_servis: row[37] || null,
    pautan_media_sosial: row[38] || null,
    premis_dilawat: parseCheckbox(row[51]),
    doc_url: row[53] || null,
    google_doc_url: row[53] || null, // Alias

    // Tracking fields
    sheets_row_number: rowNumber,
    source: 'sheets_sync',
    submission_date: row[0] || null, // Timestamp
    updated_at: new Date().toISOString()
  };
}

/**
 * Safely parse JSON string
 * @param {string} jsonString - JSON string to parse
 * @returns {Object|Array|null} Parsed JSON or null if invalid
 */
function parseJSON(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') return null;

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.warn('Failed to parse JSON:', jsonString.substring(0, 50));
    return null;
  }
}

/**
 * Parse Malaysian date/time format to ISO string
 * Format: "24/09/2025, 12:42:34" → "2025-09-24T12:42:34"
 * @param {string} malaysianDateTime - Date/time in Malaysian format
 * @returns {string|null} ISO format timestamp or null
 */
function parseMalaysianDateTime(malaysianDateTime) {
  if (!malaysianDateTime) return null;

  try {
    // Format: "DD/MM/YYYY, HH:MM:SS"
    const match = malaysianDateTime.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, day, month, year, hour, minute, second] = match;

    // Pad with zeros
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    const paddedHour = hour.padStart(2, '0');

    // Build ISO string
    return `${year}-${paddedMonth}-${paddedDay}T${paddedHour}:${minute}:${second}`;
  } catch (err) {
    console.warn('Failed to parse Malaysian date/time:', malaysianDateTime);
    return null;
  }
}

/**
 * Parse Maju image URLs from row
 * @param {Array} row - Sheet row data
 * @returns {Object|null} Image URLs object
 */
function parseMajuImageURLs(row) {
  const imageURLs = {};

  // URL_GAMBAR_PREMIS_JSON (column 22) - JSON array string
  const premisParsed = parseJSON(row[22]);
  if (premisParsed) {
    imageURLs.premis = Array.isArray(premisParsed) ? premisParsed : [premisParsed];
  }

  // URL_GAMBAR_SESI_JSON (column 23) - JSON array string
  const sesiParsed = parseJSON(row[23]);
  if (sesiParsed) {
    imageURLs.sesi = Array.isArray(sesiParsed) ? sesiParsed : [sesiParsed];
  }

  // URL_GAMBAR_GW360 (column 24) - single URL
  if (row[24]) {
    imageURLs.growthwheel = row[24];
  }

  return Object.keys(imageURLs).length > 0 ? imageURLs : null;
}

/**
 * Map complete LaporanMaju row to Maju report object
 * @param {Array} row - Sheet row data
 * @param {number} rowNumber - Row number in sheet (1-indexed)
 * @param {Object} resolvedEntities - {entrepreneur_id, mentor_id, session_id, folder_id}
 * @returns {Object} Report object ready for Supabase
 */
function mapMajuRow(row, rowNumber, resolvedEntities) {
  const sessionNumber = row[9] ? parseInt(row[9], 10) : null; // SESI_NUMBER already numeric
  const miaStatus = row[27] || 'Tidak MIA';
  const isMIA = miaStatus.toLowerCase().includes('mia') && !miaStatus.toLowerCase().includes('tidak');

  return {
    // Foreign keys
    session_id: resolvedEntities.session_id,
    mentor_id: resolvedEntities.mentor_id,
    entrepreneur_id: resolvedEntities.entrepreneur_id,
    folder_id: resolvedEntities.folder_id || row[25] || null, // Mentee_Folder_ID column 25

    // Program and session info
    program: 'Maju',
    session_number: sessionNumber,
    session_date: row[8] || null, // TARIKH_SESI
    status: 'submitted',
    mia_status: miaStatus,
    mia_reason: isMIA ? (row[28] || null) : null,
    mia_proof_url: isMIA ? (row[29] || null) : null,

    // Denormalized names (IMPORTANT: Maju uses different column names)
    nama_mentee: row[3] || null, // NAMA_MENTEE (not nama_usahawan)
    nama_usahawan: row[3] || null, // Alias for compatibility
    nama_bisnes: row[4] || null, // NAMA_BISNES
    nama_syarikat: row[4] || null, // Alias
    nama_mentor: row[1] || null, // NAMA_MENTOR
    mentor_email: row[2] || null, // EMAIL_MENTOR

    // Maju-specific fields
    lokasi_bisnes: row[5] || null,
    produk_servis: row[6] || null,
    no_telefon: row[7] || null,
    mod_sesi: row[10] || null, // MOD_SESI
    lokasi_f2f: row[11] || null,
    masa_mula: row[12] || null, // MASA_MULA
    masa_tamat: row[13] || null, // MASA_TAMAT
    latarbelakang_usahawan: row[14] || null, // Session 1 only

    // JSONB fields
    data_kewangan_bulanan: parseJSON(row[15]), // DATA_KEWANGAN_BULANAN_JSON
    mentoring_findings: parseJSON(row[16]), // MENTORING_FINDINGS_JSON
    image_urls: parseMajuImageURLs(row),

    // Mentor reflections
    refleksi_mentor_perasaan: row[17] || null,
    refleksi_mentor_komitmen: row[18] || null,
    refleksi_mentor_lain: row[19] || null,

    // Business status
    status_perniagaan: row[20] || null, // STATUS_PERNIAGAAN_KESELURUHAN
    rumusan_langkah_kehadapan: row[21] || null, // RUMUSAN_DAN_LANGKAH_KEHADAPAN

    // Google integration
    doc_url: row[26] || null, // Laporan_Maju_Doc_ID
    google_doc_url: row[26] || null, // Alias

    // Tracking fields
    sheets_row_number: rowNumber,
    source: 'sheets_sync',
    submission_date: parseMalaysianDateTime(row[0]) || row[0] || null, // Convert Malaysian timestamp
    updated_at: new Date().toISOString()
  };
}

/**
 * Parse numeric value (handles RM formatting, commas, etc.)
 * @param {string|number} value - Value to parse
 * @returns {number|null} Numeric value or null
 */
function parseNumeric(value) {
  if (value === null || value === undefined || value === '') return null;

  // Convert to string and clean up
  let cleaned = value.toString()
    .replace(/RM\s*/gi, '')  // Remove RM prefix
    .replace(/,/g, '')        // Remove commas
    .trim();

  if (cleaned === '') return null;

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse integer value
 * @param {string|number} value - Value to parse
 * @returns {number|null} Integer value or null
 */
function parseInteger(value) {
  if (value === null || value === undefined || value === '') return null;

  const cleaned = value.toString().replace(/,/g, '').trim();
  if (cleaned === '') return null;

  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Split comma-separated string into array
 * @param {string} value - Comma-separated string
 * @returns {Array<string>|null} Array of strings or null
 */
function splitCommaSeparated(value) {
  if (!value || typeof value !== 'string') return null;

  const items = value.split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);

  return items.length > 0 ? items : null;
}

/**
 * Parse date from Malaysian format (DD/MM/YYYY or DD-MM-YYYY)
 * @param {string} dateStr - Date string
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null
 */
function parseMalaysianDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Format: "DD/MM/YYYY" or "DD-MM-YYYY"
    const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!match) return null;

    const [, day, month, year] = match;

    // Pad with zeros
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');

    // Build ISO date string
    return `${year}-${paddedMonth}-${paddedDay}`;
  } catch (err) {
    console.warn('Failed to parse Malaysian date:', dateStr);
    return null;
  }
}

/**
 * Map complete UM row to Upward Mobility report object
 * @param {Array} row - Sheet row data (44 columns A-AR)
 * @param {number} rowNumber - Row number in sheet (1-indexed)
 * @param {Object} resolvedEntities - {entrepreneur_id, mentor_id}
 * @returns {Object} UM report object ready for Supabase
 */
function mapUMRow(row, rowNumber, resolvedEntities) {
  return {
    // Foreign keys
    entrepreneur_id: resolvedEntities.entrepreneur_id,
    mentor_id: resolvedEntities.mentor_id,

    // Core fields
    program: row[2] || 'iTEKAD BangKIT',  // Column C
    batch: row[3] || null,                 // Column D
    sesi_mentoring: row[4] || null,        // Column E ('Sesi 2' or 'Sesi 4')
    report_date: parseMalaysianDateTime(row[0]) || row[0] || null, // Column A

    // Business info
    jenis_perniagaan: row[8] || null,      // Column I

    // Status & mobility
    status_penglibatan: row[11] || null,   // Column L
    upward_mobility_status: row[12] || null, // Column M ('G1', 'G2', 'G3', 'NIL')
    kriteria_improvement: row[13] || null,  // Column N
    tarikh_lawatan: parseMalaysianDate(row[14]) || row[14] || null, // Column O

    // Banking facilities (Yes/No text)
    penggunaan_akaun_semasa: row[15] || null,   // Column P
    penggunaan_bimb_biz: row[16] || null,       // Column Q
    buka_akaun_al_awfar: row[17] || null,       // Column R
    penggunaan_bimb_merchant: row[18] || null,  // Column S
    lain_lain_fasiliti: row[19] || null,        // Column T
    langgan_mesin_kira: row[20] || null,        // Column U

    // Financial metrics - Pendapatan (Revenue)
    pendapatan_sebelum: parseNumeric(row[21]),  // Column V
    pendapatan_selepas: parseNumeric(row[22]),  // Column W
    ulasan_pendapatan: row[23] || null,         // Column X

    // Financial metrics - Peluang Pekerjaan (Employment)
    pekerjaan_sebelum: parseInteger(row[24]),   // Column Y
    pekerjaan_selepas: parseInteger(row[25]),   // Column Z
    ulasan_pekerjaan: row[26] || null,          // Column AA

    // Financial metrics - Nilai Aset (Assets)
    aset_bukan_tunai_sebelum: parseNumeric(row[27]), // Column AB
    aset_bukan_tunai_selepas: parseNumeric(row[28]), // Column AC
    aset_tunai_sebelum: parseNumeric(row[29]),       // Column AD
    aset_tunai_selepas: parseNumeric(row[30]),       // Column AE
    ulasan_aset: row[31] || null,                    // Column AF

    // Financial metrics - Simpanan (Savings)
    simpanan_sebelum: parseNumeric(row[32]),    // Column AG
    simpanan_selepas: parseNumeric(row[33]),    // Column AH
    ulasan_simpanan: row[34] || null,           // Column AI

    // Financial metrics - Zakat
    zakat_sebelum: parseNumeric(row[35]),       // Column AJ
    zakat_selepas: parseNumeric(row[36]),       // Column AK
    ulasan_zakat: row[37] || null,              // Column AL

    // Digital adoption (text arrays)
    digital_sebelum: splitCommaSeparated(row[38]),  // Column AM
    digital_selepas: splitCommaSeparated(row[39]),  // Column AN
    ulasan_digital: row[40] || null,                // Column AO

    // Online sales & marketing (text arrays)
    online_sales_sebelum: splitCommaSeparated(row[41]), // Column AP
    online_sales_selepas: splitCommaSeparated(row[42]), // Column AQ
    ulasan_online_sales: row[43] || null,               // Column AR

    // Tracking fields
    sheets_row_number: rowNumber,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

module.exports = {
  parseSessionNumber,
  parseInisiatif,
  parseJualanTerkini,
  parseRefleksi,
  parseGWSkor,
  parseImageURLs,
  parseCheckbox,
  parseJSON,
  parseMalaysianDateTime,
  parseMajuImageURLs,
  mapBangkitRow,
  mapMajuRow,
  // UM-specific exports
  parseNumeric,
  parseInteger,
  splitCommaSeparated,
  parseMalaysianDate,
  mapUMRow
};
