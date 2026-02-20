/**
 * lib/mia.js
 *
 * Shared MIA (Missing In Action) utilities for iTEKAD Mentor Portal
 * Supports the enhanced 3-proof MIA approval workflow
 *
 * Used by: laporan-bangkit.js, laporan-maju-um.js, /pages/admin/mia.js
 *
 * Features:
 * - 3-proof validation (WhatsApp, Email, Call)
 * - MIA request approval workflow
 * - BIMB escalation message generation
 * - Status tracking and display
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * MIA status values (matches mia_requests table enum)
 */
export const MIA_STATUS = {
  REQUESTED: 'requested',         // Initial submission
  BIMB_CONTACTED: 'bimb_contacted', // BIMB has been notified
  APPROVED: 'approved',            // MIA confirmed by admin
  REJECTED: 'rejected'             // MIA rejected by admin
};

/**
 * MIA proof types with Malay labels
 */
export const MIA_PROOF_TYPES = {
  WHATSAPP: {
    key: 'whatsapp',
    label: 'Bukti WhatsApp',
    description: 'Screenshot percubaan menghubungi melalui WhatsApp',
    field: 'proof_whatsapp_url'
  },
  EMAIL: {
    key: 'email',
    label: 'Bukti E-mel',
    description: 'Screenshot e-mel yang dihantar kepada usahawan',
    field: 'proof_email_url'
  },
  CALL: {
    key: 'call',
    label: 'Bukti Panggilan',
    description: 'Screenshot log panggilan telefon',
    field: 'proof_call_url'
  }
};

/**
 * Malay status labels for display
 */
export const MIA_STATUS_LABELS = {
  [MIA_STATUS.REQUESTED]: 'Menunggu Semakan',
  [MIA_STATUS.BIMB_CONTACTED]: 'BIMB Dihubungi',
  [MIA_STATUS.APPROVED]: 'Diluluskan',
  [MIA_STATUS.REJECTED]: 'Ditolak'
};

/**
 * Status badge color mappings (Tailwind classes)
 */
export const MIA_STATUS_COLORS = {
  [MIA_STATUS.REQUESTED]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  [MIA_STATUS.BIMB_CONTACTED]: 'bg-blue-100 text-blue-800 border-blue-300',
  [MIA_STATUS.APPROVED]: 'bg-green-100 text-green-800 border-green-300',
  [MIA_STATUS.REJECTED]: 'bg-red-100 text-red-800 border-red-300'
};

/**
 * Validation constraints
 */
export const MIA_CONFIG = {
  MIN_REASON_LENGTH: 20,
  MAX_REASON_LENGTH: 1000,
  MAX_PROOF_SIZE_MB: 10,
  ALLOWED_PROOF_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.pdf']
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate that all 3 MIA proofs are uploaded
 * @param {Object} proofs - { whatsapp: File|null, email: File|null, call: File|null }
 * @returns {boolean} - True if all 3 proofs are present
 */
export const validateMIAProofs = (proofs) => {
  if (!proofs) return false;

  const { whatsapp, email, call } = proofs;

  return !!(whatsapp && email && call);
};

/**
 * Validate individual proof file
 * @param {File} file - Proof file to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export const validateProofFile = (file) => {
  if (!file) {
    return { valid: false, error: 'Fail tidak dijumpai' };
  }

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MIA_CONFIG.MAX_PROOF_SIZE_MB) {
    return {
      valid: false,
      error: `Saiz fail terlalu besar (${fileSizeMB.toFixed(2)}MB). Maksimum ${MIA_CONFIG.MAX_PROOF_SIZE_MB}MB`
    };
  }

  // Check file type
  if (!MIA_CONFIG.ALLOWED_PROOF_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Format fail tidak sah. Sila muat naik JPG, PNG, atau PDF sahaja'
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate MIA reason text
 * @param {string} reason - MIA reason text
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export const validateMIAReason = (reason) => {
  if (!reason || reason.trim() === '') {
    return { valid: false, error: 'Alasan MIA wajib diisi' };
  }

  const trimmedLength = reason.trim().length;

  if (trimmedLength < MIA_CONFIG.MIN_REASON_LENGTH) {
    return {
      valid: false,
      error: `Alasan terlalu pendek (${trimmedLength} aksara). Minimum ${MIA_CONFIG.MIN_REASON_LENGTH} aksara`
    };
  }

  if (trimmedLength > MIA_CONFIG.MAX_REASON_LENGTH) {
    return {
      valid: false,
      error: `Alasan terlalu panjang (${trimmedLength} aksara). Maksimum ${MIA_CONFIG.MAX_REASON_LENGTH} aksara`
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate complete MIA form submission
 * @param {Object} miaData - { reason: string, proofs: Object }
 * @returns {Object} - { valid: boolean, errors: Array }
 */
export const validateMIAForm = (miaData) => {
  const errors = [];
  const { reason, proofs } = miaData;

  // Validate reason
  const reasonValidation = validateMIAReason(reason);
  if (!reasonValidation.valid) {
    errors.push(reasonValidation.error);
  }

  // Validate all 3 proofs
  if (!validateMIAProofs(proofs)) {
    errors.push('Ketiga-tiga bukti (WhatsApp, E-mel, Panggilan) adalah wajib dimuat naik');
  } else {
    // Validate individual proof files
    Object.values(MIA_PROOF_TYPES).forEach(proofType => {
      const file = proofs[proofType.key];
      if (file) {
        const fileValidation = validateProofFile(file);
        if (!fileValidation.valid) {
          errors.push(`${proofType.label}: ${fileValidation.error}`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// ============================================================================
// STATUS HELPER FUNCTIONS
// ============================================================================

/**
 * Check if MIA request is pending approval
 * @param {string} status - MIA status value
 * @returns {boolean}
 */
export const isMIAPending = (status) => {
  return status === MIA_STATUS.REQUESTED || status === MIA_STATUS.BIMB_CONTACTED;
};

/**
 * Check if MIA request is approved
 * @param {string} status - MIA status value
 * @returns {boolean}
 */
export const isMIAApproved = (status) => {
  return status === MIA_STATUS.APPROVED;
};

/**
 * Check if MIA request is rejected
 * @param {string} status - MIA status value
 * @returns {boolean}
 */
export const isMIARejected = (status) => {
  return status === MIA_STATUS.REJECTED;
};

/**
 * Get Malay label for MIA status
 * @param {string} status - MIA status value
 * @returns {string} - Malay status label
 */
export const getMIAStatusLabel = (status) => {
  return MIA_STATUS_LABELS[status] || 'Status Tidak Diketahui';
};

/**
 * Get Tailwind CSS classes for status badge
 * @param {string} status - MIA status value
 * @returns {string} - CSS classes
 */
export const getMIAStatusBadgeClasses = (status) => {
  return MIA_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 border-gray-300';
};

// ============================================================================
// BIMB MESSAGE GENERATION
// ============================================================================

/**
 * Generate formatted BIMB escalation message
 * @param {Object} menteeData - Mentee information
 * @param {string} program - 'bangkit' | 'maju'
 * @param {string} batch - Batch identifier
 * @returns {string} - Formatted message ready to copy
 */
export const generateBIMBMessage = (menteeData, program, batch) => {
  const programName = program === 'bangkit' ? 'BANGKIT' : 'MAJU';

  const message = `*MAKLUMAN MIA — iTEKAD ${programName} ${batch.toUpperCase()}*

Batch: ${batch}
Nama Usahawan: ${menteeData.mentee_name || menteeData.menteeName || 'N/A'}
Nama Syarikat: ${menteeData.mentee_company || menteeData.menteeCompany || 'N/A'}
Jenis Bisnes: ${menteeData.mentee_business_type || menteeData.menteeBusinessType || 'N/A'}
Lokasi Bisnes: ${menteeData.mentee_location || menteeData.menteeLocation || 'N/A'}
No. Telefon: ${menteeData.mentee_phone || menteeData.menteePhone || 'N/A'}

Mentor telah membuat 3 percubaan menghubungi usahawan tanpa maklum balas. Mohon pihak BIMB dapat membantu menghubungi usahawan tersebut.

Terima kasih.`;

  return message;
};

/**
 * Copy text to clipboard (browser only)
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
export const copyToClipboard = async (text) => {
  // Check if running in browser
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    console.error('Clipboard API not available');
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

// ============================================================================
// DATA PREPARATION
// ============================================================================

/**
 * Prepare MIA request payload for mia_requests table
 * @param {Object} formData - Form data from submission
 * @param {string} program - 'bangkit' | 'maju'
 * @returns {Object} - Payload ready for Supabase insert
 */
export const prepareMIARequestPayload = (formData, program) => {
  const {
    // Mentor data
    mentorEmail,
    mentorName,
    mentorId,

    // Mentee data
    menteeName,
    menteeId,
    menteeIC,
    menteeCompany,
    menteeBusinessType,
    menteeLocation,
    menteePhone,

    // Session data
    sessionNumber,
    sesiLaporan,
    batch,

    // MIA data
    miaReason,
    alasan,
    proofWhatsappUrl,
    proofEmailUrl,
    proofCallUrl,

    // Optional
    reportId
  } = formData;

  return {
    // Program context
    program: program.toLowerCase(),
    batch: batch || '',

    // Mentor info
    mentor_id: mentorId || mentorEmail,
    mentor_name: mentorName || '',

    // Mentee info
    mentee_id: menteeId || menteeIC || '',
    mentee_name: menteeName || '',
    mentee_company: menteeCompany || null,
    mentee_business_type: menteeBusinessType || null,
    mentee_location: menteeLocation || null,
    mentee_phone: menteePhone || null,

    // Session
    session_number: parseInt(sessionNumber || sesiLaporan || 1),

    // MIA details
    alasan: miaReason || alasan || '',
    proof_whatsapp_url: proofWhatsappUrl || '',
    proof_email_url: proofEmailUrl || '',
    proof_call_url: proofCallUrl || '',

    // Status tracking (defaults)
    status: MIA_STATUS.REQUESTED,
    requested_at: new Date().toISOString(),

    // Optional link to session report
    report_id: reportId || null
  };
};

/**
 * Prepare Google Sheets row data for MIA submission
 * @param {Object} formData - Form data from submission
 * @param {Object} existingRow - Existing session row data (non-MIA fields)
 * @param {string} miaRequestId - UUID from mia_requests table
 * @returns {Object} - Additional columns for Sheets
 */
export const prepareMIASheetsData = (formData, existingRow, miaRequestId) => {
  return {
    ...existingRow,
    // New MIA proof columns
    mia_proof_whatsapp: formData.proofWhatsappUrl || '',
    mia_proof_emel: formData.proofEmailUrl || '',
    mia_proof_panggilan: formData.proofCallUrl || '',
    // Link to mia_requests table
    mia_request_id: miaRequestId || '',
    // Current status
    mia_status: getMIAStatusLabel(MIA_STATUS.REQUESTED)
  };
};

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get MIA checkbox container classes
 * @param {boolean} isChecked - Whether MIA is checked
 * @returns {string} - Tailwind CSS classes
 */
export const getMIACheckboxClasses = (isChecked) => {
  const baseClasses = 'my-4 p-4 rounded-lg flex items-center justify-center transition-colors';

  if (isChecked) {
    return `${baseClasses} bg-yellow-50 border-2 border-yellow-300`;
  }

  return `${baseClasses} bg-gray-50 border-2 border-gray-200`;
};

/**
 * Get submit button text based on context
 * @param {string} program - 'bangkit' | 'maju'
 * @param {number} sessionNumber - Current session number
 * @param {boolean} isMIA - Whether MIA is checked
 * @returns {string} - Button text
 */
export const getSubmitButtonText = (program, sessionNumber, isMIA) => {
  if (isMIA) {
    return `Hantar Laporan MIA - Sesi ${sessionNumber}`;
  }

  return `Hantar Laporan Sesi ${sessionNumber}`;
};

/**
 * Format date for display in Malay format
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date (e.g., "20 Feb 2026")
 */
export const formatMalaysianDate = (date) => {
  if (!date) return 'N/A';

  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  const months = [
    'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'
  ];

  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Format timestamp for display
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string} - Formatted timestamp (e.g., "20 Feb 2026, 2:30 PM")
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'N/A';

  const dateStr = formatMalaysianDate(date);
  const timeStr = date.toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return `${dateStr}, ${timeStr}`;
};

// ============================================================================
// LEGACY COMPATIBILITY (from lib_mia_proposed.js)
// ============================================================================

/**
 * Check if validation should be skipped when MIA is checked
 * Used by other form validation functions (e.g., validateUpwardMobility)
 * @param {boolean} isMIA - Whether MIA checkbox is checked
 * @returns {boolean} - True if should skip other validations
 */
export const shouldSkipValidation = (isMIA) => {
  return isMIA === true;
};

/**
 * Check if UM sheet write should be skipped
 * @param {Object|string} statusOrData - Session status OR full data object
 * @param {Object} upwardMobilityData - UM data (optional)
 * @returns {boolean} - True if should skip UM write
 */
export const shouldSkipUMSheetWrite = (statusOrData, upwardMobilityData = null) => {
  let status = null;
  let umData = upwardMobilityData;

  // Handle object or string input
  if (typeof statusOrData === 'object' && statusOrData !== null) {
    const data = statusOrData;
    status = data.STATUS_SESI || data.MIA_STATUS || data.status;
    umData = data.UPWARD_MOBILITY_JSON || umData;
  } else {
    status = statusOrData;
  }

  // Skip if MIA
  if (status === 'MIA') {
    return true;
  }

  // Skip if no UM data
  if (!umData) {
    return true;
  }

  // Skip if UM data is empty
  if (typeof umData === 'string') {
    try {
      const parsed = JSON.parse(umData);
      if (Object.keys(parsed).length === 0) {
        return true;
      }
    } catch (e) {
      return true;
    }
  } else if (typeof umData === 'object') {
    if (Object.keys(umData).length === 0) {
      return true;
    }
  }

  return false;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants
  MIA_STATUS,
  MIA_PROOF_TYPES,
  MIA_STATUS_LABELS,
  MIA_STATUS_COLORS,
  MIA_CONFIG,

  // Validation
  validateMIAProofs,
  validateProofFile,
  validateMIAReason,
  validateMIAForm,

  // Status helpers
  isMIAPending,
  isMIAApproved,
  isMIARejected,
  getMIAStatusLabel,
  getMIAStatusBadgeClasses,

  // BIMB message
  generateBIMBMessage,
  copyToClipboard,

  // Data preparation
  prepareMIARequestPayload,
  prepareMIASheetsData,

  // UI helpers
  getMIACheckboxClasses,
  getSubmitButtonText,
  formatMalaysianDate,
  formatTimestamp,

  // Legacy compatibility
  shouldSkipValidation,
  shouldSkipUMSheetWrite
};
