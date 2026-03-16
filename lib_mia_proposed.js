/**
 * lib/mia.js
 * 
 * Shared MIA (Missing In Action) utilities for mentor reporting system
 * Used by: laporan-bangkit.js, laporan-maju-um.js, and future forms
 * 
 * Centralizes:
 * - MIA validation logic
 * - MIA form rendering
 * - MIA data preparation
 * - MIA state management
 * - Consecutive MIA detection
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIA_CONFIG = {
  // Form field requirements
  REQUIRED_FIELDS: ['reason', 'proof'],
  
  // Validation limits
  MIN_REASON_LENGTH: 20,
  MAX_REASON_LENGTH: 1000,
  MAX_PROOF_SIZE_MB: 10,
  
  // Consecutive MIA thresholds
  WARNING_THRESHOLD: 2,      // Show warning at 2nd MIA
  CRITICAL_THRESHOLD: 3,     // Require coordinator approval at 3rd
  
  // Status values
  STATUS_VALUES: {
    ACTIVE: '',
    MIA: 'MIA',
    SELESAI: 'Selesai',
  }
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate MIA form submission
 * @param {Object} miaData - { reason: string, proofFile: File|null, programType?: string }
 * @returns {Array} - Array of error messages (empty if valid)
 */
export const validateMIAForm = (miaData) => {
  const errors = [];
  const { reason, proofFile, programType = 'maju' } = miaData;
  
  // Validate reason (required for both programs)
  if (!reason || reason.trim() === '') {
    errors.push('Alasan/Sebab Usahawan MIA adalah wajib diisi');
  } else if (reason.trim().length < MIA_CONFIG.MIN_REASON_LENGTH) {
    errors.push(`Alasan minimum ${MIA_CONFIG.MIN_REASON_LENGTH} aksara`);
  }
  
  // Validate proof file
  // BANGKIT: Optional (nice to have)
  // MAJU: Mandatory (required)
  const proofRequired = programType === 'maju';
  
  if (proofRequired && !proofFile) {
    errors.push('Bukti MIA (screenshot/dokumen) adalah wajib dimuat naik');
  }
  
  // If proof file is provided, validate it
  if (proofFile) {
    // Check file size
    const fileSizeMB = proofFile.size / (1024 * 1024);
    if (fileSizeMB > MIA_CONFIG.MAX_PROOF_SIZE_MB) {
      errors.push(`Saiz fail tidak boleh melebihi ${MIA_CONFIG.MAX_PROOF_SIZE_MB}MB`);
    }
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(proofFile.type)) {
      errors.push('Format fail tidak sah. Sila muat naik JPG, PNG, atau PDF');
    }
  }
  
  return errors;
};

/**
 * Check if all form validations should be skipped when MIA is checked
 * This is used by other validation functions (e.g., validateUpwardMobility)
 * @param {boolean} isMIA - Whether MIA checkbox is checked
 * @returns {boolean} - True if should skip other validations
 */
export const shouldSkipValidation = (isMIA) => {
  return isMIA === true;
};

// ============================================================================
// STATE DETECTION
// ============================================================================

/**
 * Detect MIA state from mentee session history
 * @param {Array} menteeRows - Array of session rows for this mentee
 * @param {Object} columnMapping - Column index mapping for the program
 * @returns {Object} - MIA state information
 */
export const detectMIAState = (menteeRows, columnMapping) => {
  if (!menteeRows || menteeRows.length === 0) {
    return {
      isMIA: false,
      consecutiveMIAs: 0,
      lastMIADate: null,
      requiresApproval: false,
      status: 'ACTIVE'
    };
  }
  
  const latestRow = menteeRows[menteeRows.length - 1];
  const statusColIndex = columnMapping.statusSesi || columnMapping.miaStatus;
  
  // Check if latest session was MIA
  const latestStatus = (latestRow[statusColIndex] || '').toString().toUpperCase();
  
  if (latestStatus !== 'MIA') {
    return {
      isMIA: false,
      consecutiveMIAs: 0,
      lastMIADate: null,
      requiresApproval: false,
      status: 'ACTIVE'
    };
  }
  
  // Count consecutive MIAs from the end
  let consecutiveCount = 0;
  let lastMIADate = null;
  
  for (let i = menteeRows.length - 1; i >= 0; i--) {
    const rowStatus = (menteeRows[i][statusColIndex] || '').toString().toUpperCase();
    
    if (rowStatus === 'MIA') {
      consecutiveCount++;
      
      // Get date if available
      if (!lastMIADate && columnMapping.sessionDate) {
        lastMIADate = menteeRows[i][columnMapping.sessionDate];
      }
    } else {
      break; // Stop at first non-MIA
    }
  }
  
  return {
    isMIA: true,
    consecutiveMIAs: consecutiveCount,
    lastMIADate: lastMIADate,
    requiresApproval: consecutiveCount >= MIA_CONFIG.CRITICAL_THRESHOLD,
    status: consecutiveCount >= MIA_CONFIG.WARNING_THRESHOLD ? 'CRITICAL_MIA' : 'MIA'
  };
};

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get MIA warning level based on consecutive count
 * @param {number} consecutiveMIAs - Number of consecutive MIA sessions
 * @returns {Object} - Warning configuration
 */
export const getMIAWarningLevel = (consecutiveMIAs) => {
  if (consecutiveMIAs === 0) {
    return {
      level: 'none',
      color: '',
      icon: '',
      message: ''
    };
  }
  
  if (consecutiveMIAs === 1) {
    return {
      level: 'info',
      color: 'blue',
      icon: 'ℹ️',
      message: 'Mentee telah ditandakan MIA. Sila pastikan anda telah cuba menghubungi mentee.'
    };
  }
  
  if (consecutiveMIAs === 2) {
    return {
      level: 'warning',
      color: 'yellow',
      icon: '⚠️',
      message: 'Mentee telah MIA 2 kali berturut-turut. Koordinator akan diberitahu.'
    };
  }
  
  // 3 or more
  return {
    level: 'critical',
    color: 'red',
    icon: '🛑',
    message: 'Mentee telah MIA 3+ kali berturut-turut. Sila hubungi koordinator sebelum meneruskan.'
  };
};

/**
 * Get styling classes for MIA checkbox container
 * @param {boolean} isChecked - Whether checkbox is currently checked
 * @returns {string} - Tailwind CSS classes
 */
export const getMIACheckboxClasses = (isChecked) => {
  const baseClasses = 'my-4 p-4 rounded-lg flex items-center justify-center';
  
  if (isChecked) {
    return `${baseClasses} bg-yellow-50 border border-yellow-200`;
  }
  
  return `${baseClasses} bg-gray-50 border border-gray-200`;
};

/**
 * Get submit button text based on program and session
 * @param {string} programType - 'bangkit' | 'maju'
 * @param {number} sessionNumber - Current session number
 * @param {boolean} isMIA - Whether MIA is checked
 * @returns {string} - Button text
 */
export const getSubmitButtonText = (programType, sessionNumber, isMIA) => {
  if (isMIA) {
    return `Hantar Laporan MIA - Sesi ${sessionNumber}`;
  }
  
  if (programType === 'bangkit') {
    return `Hantar Laporan Sesi ${sessionNumber}`;
  }
  
  return 'Submit Laporan Maju';
};

// ============================================================================
// DATA PREPARATION
// ============================================================================

/**
 * Prepare MIA data for submission
 * @param {Object} params - Submission parameters
 * @returns {Object} - Formatted data ready for backend
 */
export const prepareMIASubmission = ({
  mentorEmail,
  menteeName,
  sessionNumber,
  programType,
  miaReason,
  miaProofUrl,
  timestamp = new Date().toISOString(),
  includeUMPlaceholder = false // Maju includes empty UM, Bangkit excludes
}) => {
  const baseData = {
    MENTOR_EMAIL: mentorEmail,
    MENTEE_NAME: menteeName,
    SESSION_NUMBER: sessionNumber,
    PROGRAM_TYPE: programType,
    SUBMISSION_DATE: timestamp,
    STATUS: 'MIA'
  };
  
  // Program-specific field names
  if (programType === 'bangkit') {
    return {
      ...baseData,
      STATUS_SESI: 'MIA',
      MIA_REASON: miaReason,
      LINK_BUKTI_MIA: miaProofUrl || '', // Optional in Bangkit
      // IMPORTANT: Bangkit EXCLUDES UM data entirely
      // Do NOT include UPWARD_MOBILITY_JSON
    };
  }
  
  if (programType === 'maju') {
    const miaData = {
      ...baseData,
      MIA_STATUS: 'MIA',
      MIA_REASON: miaReason,
      MIA_PROOF_URL: miaProofUrl, // Required in Maju
    };
    
    // IMPORTANT: Maju INCLUDES empty UM placeholder
    if (includeUMPlaceholder) {
      miaData.UPWARD_MOBILITY_JSON = JSON.stringify({
        // Empty/null UM data
        section3: null,
        section4: null,
        section5: null,
        section6: null
      });
    }
    
    return miaData;
  }
  
  return baseData;
};

/**
 * Check if UM sheet write should be skipped
 * @param {string|Object} statusOrData - Session status string OR full data object
 * @param {Object} upwardMobilityData - UM data object (optional if using data object)
 * @param {string} programType - 'bangkit' or 'maju' (optional, inferred from fields)
 * @returns {boolean} - True if should skip UM sheet write
 */
export const shouldSkipUMSheetWrite = (statusOrData, upwardMobilityData = null, programType = null) => {
  // Handle two call patterns:
  // 1. shouldSkipUMSheetWrite(status, umData) - legacy
  // 2. shouldSkipUMSheetWrite(dataObject) - new, more flexible
  
  let status = null;
  let umData = upwardMobilityData;
  
  if (typeof statusOrData === 'object' && statusOrData !== null) {
    // Called with data object
    const data = statusOrData;
    
    // Determine status based on available fields
    if (data.STATUS_SESI) {
      status = data.STATUS_SESI; // Bangkit
      umData = data.UPWARD_MOBILITY_JSON;
    } else if (data.MIA_STATUS) {
      status = data.MIA_STATUS; // Maju
      umData = data.UPWARD_MOBILITY_JSON;
    } else if (data.status) {
      status = data.status; // Generic
    }
  } else {
    // Called with status string
    status = statusOrData;
  }
  
  // Skip if status is MIA (both programs use 'MIA' as the value)
  if (status === 'MIA') {
    return true;
  }
  
  // Skip if no UM data provided
  if (!umData) {
    return true;
  }
  
  // Skip if UM data is empty object
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
// FORM STATE MANAGEMENT
// ============================================================================

/**
 * Get initial MIA state for form
 * @param {Object} previousSessionData - Data from previous session (if any)
 * @returns {Object} - Initial state
 */
export const getInitialMIAState = (previousSessionData = null) => {
  return {
    isMIA: false, // Always start unchecked for new session
    reason: '',
    proofFile: null,
    proofPreview: null,
    errors: []
  };
};

/**
 * Handle MIA checkbox toggle
 * @param {boolean} newValue - New checkbox state
 * @param {Object} currentState - Current form state
 * @returns {Object} - Updated state
 */
export const handleMIAToggle = (newValue, currentState) => {
  if (newValue === true) {
    // MIA checked - clear non-MIA errors
    return {
      ...currentState,
      isMIA: true,
      errors: [] // Clear previous errors since validation changes
    };
  } else {
    // MIA unchecked - reset MIA fields
    return {
      ...currentState,
      isMIA: false,
      reason: '',
      proofFile: null,
      proofPreview: null,
      errors: []
    };
  }
};

// ============================================================================
// BLOCKING & ACCESS CONTROL
// ============================================================================

/**
 * Determine if form should be blocked due to previous MIA
 * @param {Object} miaState - MIA state from detectMIAState()
 * @param {number} currentSessionNumber - Session number being attempted
 * @returns {Object} - Blocking information
 */
export const checkFormAccess = (miaState, currentSessionNumber) => {
  if (!miaState.isMIA) {
    return {
      isBlocked: false,
      reason: null,
      canOverride: false,
      requiresAdminAction: false
    };
  }
  
  // Form is blocked if previous session was MIA
  return {
    isBlocked: true,
    reason: 'Usahawan ini telah ditandakan sebagai MIA (Missing In Action) dan tidak boleh diisi borang lagi.',
    canOverride: false, // Only admin can reactivate
    requiresAdminAction: true,
    actionRequired: 'reactivation',
    consecutiveMIAs: miaState.consecutiveMIAs
  };
};

/**
 * Check if coordinator approval is required for marking MIA
 * @param {number} consecutiveMIAs - Current consecutive MIA count
 * @returns {Object} - Approval requirement information
 */
export const checkApprovalRequired = (consecutiveMIAs) => {
  if (consecutiveMIAs < MIA_CONFIG.CRITICAL_THRESHOLD) {
    return {
      required: false,
      message: null
    };
  }
  
  return {
    required: true,
    message: `Mentee telah MIA ${consecutiveMIAs} kali berturut-turut. Kelulusan koordinator diperlukan untuk meneruskan.`,
    contactInfo: {
      role: 'Koordinator Program',
      action: 'Sila hubungi koordinator untuk mendapatkan kelulusan'
    }
  };
};

// ============================================================================
// REACT COMPONENT HELPERS
// ============================================================================

/**
 * Generate MIA checkbox JSX
 * @param {Object} props - Component props
 * @returns {JSX.Element} - Checkbox component
 */
export const renderMIACheckbox = ({ 
  isMIA, 
  onChange, 
  disabled = false,
  consecutiveMIAs = 0 
}) => {
  // This would need to be adapted based on whether you're using React or another framework
  // For now, returning the HTML structure as a guide
  
  const checkboxClasses = getMIACheckboxClasses(isMIA);
  const warningLevel = getMIAWarningLevel(consecutiveMIAs);
  
  return {
    containerClasses: checkboxClasses,
    inputProps: {
      type: 'checkbox',
      id: 'mia-checkbox',
      checked: isMIA,
      onChange: (e) => onChange(e.target.checked),
      disabled: disabled,
      className: 'h-5 w-5 rounded text-red-600 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed'
    },
    labelProps: {
      htmlFor: 'mia-checkbox',
      className: 'ml-3 font-semibold text-gray-700',
      text: 'Tandakan jika Usahawan Tidak Hadir / MIA'
    },
    warningLevel: warningLevel
  };
};

// ============================================================================
// ADMIN FUNCTIONS (For Future Implementation)
// ============================================================================

/**
 * Validate reactivation request
 * @param {Object} reactivationData - Admin's reactivation request
 * @returns {Object} - Validation result
 */
export const validateReactivation = (reactivationData) => {
  const errors = [];
  
  if (!reactivationData.menteeId) {
    errors.push('Mentee ID is required');
  }
  
  if (!reactivationData.adminEmail) {
    errors.push('Admin email is required');
  }
  
  // Notes are optional but recommended
  if (reactivationData.notes && reactivationData.notes.length > 500) {
    errors.push('Notes cannot exceed 500 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

/**
 * Prepare reactivation log entry
 * @param {Object} params - Reactivation parameters
 * @returns {Object} - Log entry data
 */
export const prepareReactivationLog = ({
  menteeId,
  menteeName,
  programType,
  adminEmail,
  adminName,
  notes = '',
  timestamp = new Date().toISOString()
}) => {
  return {
    action: 'REACTIVATE',
    menteeId: menteeId,
    menteeName: menteeName,
    programType: programType,
    performedBy: adminEmail,
    performedByName: adminName,
    notes: notes,
    timestamp: timestamp,
    previousStatus: 'MIA',
    newStatus: 'ACTIVE'
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants
  MIA_CONFIG,
  
  // Validation
  validateMIAForm,
  shouldSkipValidation,
  
  // State detection
  detectMIAState,
  
  // UI helpers
  getMIAWarningLevel,
  getMIACheckboxClasses,
  getSubmitButtonText,
  
  // Data preparation
  prepareMIASubmission,
  shouldSkipUMSheetWrite,
  
  // Form state
  getInitialMIAState,
  handleMIAToggle,
  
  // Access control
  checkFormAccess,
  checkApprovalRequired,
  
  // React helpers
  renderMIACheckbox,
  
  // Admin functions
  validateReactivation,
  prepareReactivationLog
};
