// pages/laporan-maju.js
import React, { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Section from '../components/Section';
import InputField from '../components/InputField';
import SelectField from '../components/SelectField';
import TextArea from '../components/TextArea';
import FileInput from '../components/FileInput';
import MIAEvidenceForm from '../components/MIAEvidenceForm';
import ReceiptModal from '../components/ReceiptModal'; // Import ReceiptModal
import InfoCard from '../components/InfoCard';
import { format } from 'date-fns';
import {
  GRADE_CRITERIA_MAP,
  UPWARD_MOBILITY_SECTIONS,
  INITIAL_UPWARD_MOBILITY_STATE,
  calculateCheckboxValue,
  calculateTagClickValue,
  validateUpwardMobility
} from '../lib/upwardMobilityUtils';

// Helper function to safely parse JSON
const safeJSONParse = (str) => {
  try {
    if (!str || str.trim() === '') {
      return [];
    }
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error parsing JSON:", e, "Input string:", str);
    return [];
  }
};

// Enhanced TextArea component with helper text (guidance always visible, never submitted)
const EnhancedTextArea = ({ label, name, value, onChange, helperText, rows = 5, required = false, disabled = false }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {helperText && (
        <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-gray-700 whitespace-pre-line">
          {helperText}
        </div>
      )}
      <textarea
        name={name}
        value={value || ''}
        onChange={onChange}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical text-gray-900 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
        rows={rows}
        required={required}
        disabled={disabled}
        placeholder={disabled ? '' : 'Taip respons anda di sini...'}
      />
    </div>
  );
};

const LaporanMajuPage = () => {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.email && process.env.NEXT_PUBLIC_ADMIN_EMAILS?.includes(session.user.email);

  const initialFormState = {
    // These match your LaporanMaju sheet headers for direct submission
    Timestamp: '',
    NAMA_MENTOR: '',
    EMAIL_MENTOR: '',
    NAMA_MENTEE: '',
    NAMA_BISNES: '',
    LOKASI_BISNES: '',
    PRODUK_SERVIS: '',
    NO_TELEFON: '',
    emel: '', // Mentee email from mapping for Supabase entrepreneur lookup
    BATCH: '',
    TARIKH_SESI: format(new Date(), 'yyyy-MM-dd'),
    SESI_NUMBER: 1,
    MOD_SESI: '',
    LOKASI_F2F: '',
    MASA_MULA: '',
    MASA_TAMAT: '',
    LATARBELAKANG_USAHAWAN: '',
    DATA_KEWANGAN_BULANAN_JSON: [],
    MENTORING_FINDINGS_JSON: [],
    URL_GAMBAR_PREMIS_JSON: [],
    URL_GAMBAR_SESI_JSON: [],
    URL_GAMBAR_GW360: '',
    Folder_ID: '',
    Laporan_Maju_Doc_ID: '',
    // NEW FIELDS for Sesi 2+
    STATUS_PERNIAGAAN_KESELURUHAN: '',
    RUMUSAN_DAN_LANGKAH_KEHADAPAN: '',
    // MIA fields
    MIA_PROOF_URL: '',
    // UPWARD MOBILITY FIELDS (Sections 3-6)
    UPWARD_MOBILITY: { ...INITIAL_UPWARD_MOBILITY_STATE },
  };

  const [formData, setFormData] = useState(initialFormState);
  const [allMenteesMapping, setAllMenteesMapping] = useState([]);
  const [mentorsInMapping, setMentorsInMapping] = useState([]);
  const [filteredMenteesForDropdown, setFilteredMenteesForDropdown] = useState([]);
  const [selectedMentorEmail, setSelectedMentorEmail] = useState(session?.user?.email || '');
  const [currentSessionNumber, setCurrentSessionNumber] = useState(1);
  const [previousMentoringFindings, setPreviousMentoringFindings] = useState([]);
  const [previousLatarBelakangUsahawan, setPreviousLatarBelakangUsahawan] = useState('');
  const [hasPremisPhotosUploaded, setHasPremisPhotosUploaded] = useState(false);
  const [lawatanPremisChecked, setLawatanPremisChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isMIA, setIsMIA] = useState(false);
  const [miaReason, setMiaReason] = useState('');
  const [miaProofFile, setMiaProofFile] = useState(null);
  const [files, setFiles] = useState({ gw360: null, sesi: [], premis: [] });
  const [compressionProgress, setCompressionProgress] = useState({ show: false, current: 0, total: 0, message: '', fileName: '' });
  const [submissionStage, setSubmissionStage] = useState({ stage: '', message: '', detail: '' });

  // Receipt Modal State
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // --- Draft/Autosave functionality ---
  const getDraftKey = (menteeName, sessionNo, mentorEmail) =>
    `laporanMaju:draft:v1:${mentorEmail || 'unknown'}:${menteeName || 'none'}:s${sessionNo}`;
  const [saveStatus, setSaveStatus] = useState('');
  const [autosaveArmed, setAutosaveArmed] = useState(false);

  // Effect to fetch mapping data on component mount
  useEffect(() => {
    const fetchMappingData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/mapping?programType=maju');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAllMenteesMapping(data);

        if (isAdmin) {
          const uniqueMentors = Array.from(new Set(data.map(m => m.Mentor_Email)))
            .map(email => {
              const mentorData = data.find(m => m.Mentor_Email === email);
              return { label: mentorData ? mentorData.Mentor : email, value: email };
            });
          setMentorsInMapping([{ label: 'Pilih Mentor', value: '' }, ...uniqueMentors]);
          if (!selectedMentorEmail && session?.user?.email && uniqueMentors.some(m => m.value === session.user.email)) {
            setSelectedMentorEmail(session.user.email);
          }
        }
      } catch (error) {
        console.error('Error fetching mapping data:', error);
        setMessage('Failed to load mentee mapping data.');
        setMessageType('error');
      } finally {
        setLoading(false);
      }
    };
    fetchMappingData();
  }, [isAdmin, session?.user?.email, selectedMentorEmail]);

  // Effect to update NAMA_MENTOR & EMAIL_MENTOR in formData based on selectedMentorEmail or logged-in user
  useEffect(() => {
    let mentorName = session?.user?.name || '';
    let mentorEmail = session?.user?.email || '';

    if (isAdmin && selectedMentorEmail) {
      const selectedMentorData = allMenteesMapping.find(m => m.Mentor_Email === selectedMentorEmail);
      if (selectedMentorData) {
        mentorName = selectedMentorData.Mentor;
        mentorEmail = selectedMentorData.Mentor_Email;
      }
    } else if (!isAdmin && session?.user?.email) {
      const loggedInMentorData = allMenteesMapping.find(m => m.Mentor_Email === session?.user?.email);
      if (loggedInMentorData) {
        mentorName = loggedInMentorData.Mentor;
        mentorEmail = loggedInMentorData.Mentor_Email;
      }
    }

    setFormData(prev => ({
      ...prev,
      NAMA_MENTOR: mentorName,
      EMAIL_MENTOR: mentorEmail,
    }));
  }, [selectedMentorEmail, allMenteesMapping, isAdmin, session?.user?.email]);

  // Filter mentees based on selected mentor (or logged-in mentor if not admin)
  useEffect(() => {
    let menteesToDisplay = [];
    if (isAdmin && selectedMentorEmail) {
      menteesToDisplay = allMenteesMapping.filter(m => m.Mentor_Email === selectedMentorEmail);
    } else if (!isAdmin && session?.user?.email) {
      menteesToDisplay = allMenteesMapping.filter(m => m.Mentor_Email === session?.user?.email);
    }
    setFilteredMenteesForDropdown(menteesToDisplay);
  }, [allMenteesMapping, selectedMentorEmail, isAdmin, session]);

  // --- Autosave effect: save to localStorage on changes ---
  useEffect(() => {
    if (!autosaveArmed) return;
    if (!formData.NAMA_MENTEE || !currentSessionNumber) return;

    const draftKey = getDraftKey(
      formData.NAMA_MENTEE,
      currentSessionNumber,
      session?.user?.email
    );

    const payload = { ...formData };

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(payload));
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        setSaveStatus(`Saved • ${timeStr}`);
      } catch {
        setSaveStatus('Unable to save draft');
      }
    }, 700);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, autosaveArmed]);

  // Handle Mentee Selection & Load Session Data
  const handleMenteeSelect = useCallback(async (e) => {
    const selectedMenteeName = e.target.value;

    setFormData(prev => ({
      ...prev,
      NAMA_MENTEE: selectedMenteeName,
      NAMA_BISNES: '',
      LOKASI_BISNES: '',
      PRODUK_SERVIS: '',
      NO_TELEFON: '',
      MOD_SESI: '',
      LOKASI_F2F: '',
      MASA_MULA: '',
      MASA_TAMAT: '',
      LATARBELAKANG_USAHAWAN: '',
      DATA_KEWANGAN_BULANAN_JSON: [],
      MENTORING_FINDINGS_JSON: [],
      URL_GAMBAR_GW360: '',
      URL_GAMBAR_SESI_JSON: [],
      URL_GAMBAR_PREMIS_JSON: [],
      Folder_ID: '',
      Laporan_Maju_Doc_ID: '',
      STATUS_PERNIAGAAN_KESELURUHAN: '',
      RUMUSAN_DAN_LANGKAH_KEHADAPAN: '',
      UPWARD_MOBILITY: { ...INITIAL_UPWARD_MOBILITY_STATE },
    }));

    setCurrentSessionNumber(1);
    setPreviousMentoringFindings([]);
    setPreviousLatarBelakangUsahawan('');
    setHasPremisPhotosUploaded(false);
    setLawatanPremisChecked(false);
    setIsMIA(false);
    setMiaReason('');
    setMiaProofFile(null);

    if (!selectedMenteeName) {
      setMessage('');
      setMessageType('');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const response = await fetch(`/api/laporanMajuData?name=${encodeURIComponent(selectedMenteeName)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const sessionData = await response.json();

      setFormData(prev => {
        const updatedFormData = { ...prev };

        if (sessionData.menteeMapping) {
          console.log('🔍 Raw mentee mapping data for', selectedMenteeName, ':', sessionData.menteeMapping);
          console.log('🔍 Available fields:', Object.keys(sessionData.menteeMapping));
          console.log('🔍 Folder_ID value:', sessionData.menteeMapping.Folder_ID);
          console.log('🔍 All possible folder fields:');
          ['Folder_ID', 'FOLDER_ID', 'FolderId', 'folder_id', 'Mentee_Folder_ID'].forEach(field => {
            console.log(`  ${field}:`, sessionData.menteeMapping[field]);
          });

          updatedFormData.NAMA_BISNES = sessionData.menteeMapping.NAMA_BISNES || '';
          updatedFormData.LOKASI_BISNES = sessionData.menteeMapping.LOKASI_BISNES || '';
          updatedFormData.PRODUK_SERVIS = sessionData.menteeMapping.PRODUK_SERVIS || '';
          updatedFormData.NO_TELEFON = sessionData.menteeMapping.NO_TELEFON || '';
          // Use the correct field name from the mapping sheet
          updatedFormData.Folder_ID = sessionData.menteeMapping.Folder_ID || '';
          // Store mentee email for Supabase entrepreneur lookup
          updatedFormData.emel = sessionData.menteeMapping.MENTEE_EMAIL_FROM_MAPPING || '';
          updatedFormData.BATCH = sessionData.menteeMapping.BATCH || ''; // Set Batch from mapping


          console.log('🔍 Final Folder_ID set to:', updatedFormData.Folder_ID);
          console.log('🔍 Mentee email (emel) set to:', updatedFormData.emel);

          // Warn if Folder_ID is empty
          if (!updatedFormData.Folder_ID) {
            console.warn('⚠️ WARNING: Folder_ID is empty for mentee:', selectedMenteeName);
            console.warn('⚠️ This will prevent image uploads. Please add Folder_ID in the mapping sheet.');
          }
        } else {
          console.log('❌ No mentee mapping data received');
        }

        updatedFormData.SESI_NUMBER = sessionData.currentSession || 1;
        setCurrentSessionNumber(sessionData.currentSession || 1);
        setIsMIA(sessionData.isMIA || false);

        if (sessionData.currentSession > 1 && sessionData.previousData) {
          setPreviousMentoringFindings(safeJSONParse(sessionData.previousData.MENTORING_FINDINGS_JSON));
          updatedFormData.DATA_KEWANGAN_BULANAN_JSON = safeJSONParse(sessionData.previousData.DATA_KEWANGAN_BULANAN_JSON);
        } else {
          setPreviousMentoringFindings([]);
          updatedFormData.DATA_KEWANGAN_BULANAN_JSON = [];
        }

        setPreviousLatarBelakangUsahawan(sessionData.latarBelakangUsahawanSesi1 || '');
        if (sessionData.currentSession === 1 && sessionData.latarBelakangUsahawanSesi1) {
          updatedFormData.LATARBELAKANG_USAHAWAN = sessionData.latarBelakangUsahawanSesi1;
        } else {
          updatedFormData.LATARBELAKANG_USAHAWAN = '';
        }

        setHasPremisPhotosUploaded(sessionData.hasPremisPhotos || false);

        return updatedFormData;
      });

      // --- Restore draft if exists ---
      try {
        const draftKey = getDraftKey(
          selectedMenteeName,
          sessionData.currentSession,
          session?.user?.email
        );
        const saved = localStorage.getItem(draftKey);

        if (saved) {
          const parsed = JSON.parse(saved);
          setFormData(prev => {
            // Preserve critical fields from API that shouldn't be overwritten by draft
            const preservedFields = {
              // Mapping-derived fields that must come from API
              NAMA_BISNES: prev.NAMA_BISNES,
              LOKASI_BISNES: prev.LOKASI_BISNES,
              PRODUK_SERVIS: prev.PRODUK_SERVIS,
              NO_TELEFON: prev.NO_TELEFON,
              Folder_ID: prev.Folder_ID,
              emel: prev.emel,
              NAMA_MENTEE: prev.NAMA_MENTEE, // Keep selected mentee name
            };

            return {
              ...prev,
              ...parsed,
              ...preservedFields, // Override draft with preserved fields
            };
          });
          setSaveStatus('Draft restored');
          console.log('📄 Draft restored for:', selectedMenteeName, 'Sesi', sessionData.currentSession);
          console.log('🔒 Preserved fields:', preservedFields);
        }
      } catch (draftError) {
        console.error('Failed to restore draft:', draftError);
      }

      // Enable autosave after data is loaded
      setAutosaveArmed(true);

    } catch (error) {
      console.error('Error fetching mentee session data:', error);
      setMessage('Failed to load mentee data and session info. Please check console for details.');
      setMessageType('error');
      setFormData(prev => ({
        ...initialFormState,
        NAMA_MENTOR: prev.NAMA_MENTOR,
        EMAIL_MENTOR: prev.EMAIL_MENTOR,
        TARIKH_SESI: format(new Date(), 'yyyy-MM-dd'),
        NAMA_MENTEE: selectedMenteeName,
      }));
      setCurrentSessionNumber(1);
      setPreviousMentoringFindings([]);
      setPreviousLatarBelakangUsahawan('');
      setHasPremisPhotosUploaded(false);
      setLawatanPremisChecked(false);
      setIsMIA(false);
      setMiaReason('');
      setMiaProofFile(null);
    } finally {
      setLoading(false);
    }
  }, [initialFormState, isAdmin, session]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDynamicChange = (section, index, field, value) => {
    setFormData(prev => {
      const updatedSection = [...prev[section]];
      if (!updatedSection[index]) {
        updatedSection[index] = {};
      }
      updatedSection[index] = { ...updatedSection[index], [field]: value };
      return { ...prev, [section]: updatedSection };
    });
  };

  const addRow = (section, initialRow = {}) => {
    setFormData(prev => ({
      ...prev,
      [section]: [...prev[section], initialRow]
    }));
  };

  const removeRow = (section, index) => {
    setFormData(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index)
    }));
  };

  // Handler for UPWARD_MOBILITY nested fields
  const handleUMChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      UPWARD_MOBILITY: {
        ...prev.UPWARD_MOBILITY,
        [field]: value
      }
    }));
  };

  // Handler for UPWARD_MOBILITY checkbox arrays
  const handleUMCheckboxChange = (field, value, checked) => {
    setFormData(prev => {
      const currentArray = prev.UPWARD_MOBILITY[field] || [];
      const updatedArray = calculateCheckboxValue(currentArray, value, checked);

      return {
        ...prev,
        UPWARD_MOBILITY: {
          ...prev.UPWARD_MOBILITY,
          [field]: updatedArray
        }
      };
    });
  };

  // Handler for Quick Tag clicks - appends criteria to textarea
  const handleTagClick = (tag) => {
    const currentValue = formData.UPWARD_MOBILITY.UM_KRITERIA_IMPROVEMENT || '';
    const newValue = calculateTagClickValue(currentValue, tag);

    // Only update if changed
    if (newValue !== currentValue) {
      handleUMChange('UM_KRITERIA_IMPROVEMENT', newValue);
    }
  };

  // HOTFIX: Use working Bangkit Apps Script for images until Maju Apps Script gets uploadImage handler
  // Simple file storage functions (like laporan-sesi)
  const handleFileChange = (type, fileList, multiple = false) => {
    setFiles((prev) => ({
      ...prev,
      [type]: multiple ? Array.from(fileList) : fileList[0]
    }));
  };

  const handleMiaProofFileChange = (e) => {
    const file = e.target.files[0];
    setMiaProofFile(file);
  };

  // Batch upload function
  const uploadImage = (file, fId, menteeName, sessionNumber) => new Promise(async (resolve, reject) => {
    try {
      const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.log(`📸 Uploading ${file.name} (${originalSizeMB}MB) to Google Drive...`);

      // Upload directly to Google Drive via /api/upload-image (not Apps Script)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', fId);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });


      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload error response:', errorText.substring(0, 200));
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Server error: ${result.error}`);
      }

      console.log('✅ Upload successful:', result.url);
      resolve(result.url);

    } catch (error) {
      console.error('❌ Upload setup failed:', error);
      reject(error);
    }
  });

  // MIA proof upload function - uses same FormData approach as uploadImage
  const uploadMiaProof = (file, fId, menteeName, sessionNumber) => new Promise(async (resolve, reject) => {
    try {
      const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.log(`📸 Uploading MIA proof ${file.name} (${originalSizeMB}MB) to Google Drive...`);

      // Upload directly to Google Drive via /api/upload-image (not Apps Script)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', fId);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ MIA upload error response:', errorText.substring(0, 200));
        throw new Error(`MIA upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Server error: ${result.error}`);
      }

      console.log('✅ MIA proof upload successful:', result.url);
      resolve(result.url);

    } catch (error) {
      console.error('❌ MIA proof upload failed:', error);
      reject(error);
    }
  });


  const resetForm = () => {
    // Clear draft from localStorage
    try {
      const draftKey = getDraftKey(
        formData.NAMA_MENTEE,
        currentSessionNumber,
        session?.user?.email
      );
      localStorage.removeItem(draftKey);
      console.log('🗑️ Draft cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }

    setFormData({
      ...initialFormState,
      NAMA_MENTOR: isAdmin ? (mentorsInMapping.find(m => m.value === selectedMentorEmail)?.label || '') : (session?.user?.name || ''),
      EMAIL_MENTOR: isAdmin ? selectedMentorEmail : (session?.user?.email || ''),
      TARIKH_SESI: format(new Date(), 'yyyy-MM-dd'),
    });
    setCurrentSessionNumber(1);
    setPreviousMentoringFindings([]);
    setPreviousLatarBelakangUsahawan('');
    setHasPremisPhotosUploaded(false);
    setLawatanPremisChecked(false);
    setMessage('');
    setMessageType('');
    setLoading(false);
    setIsMIA(false);
    setMiaReason('');
    setMiaProofFile(null);
    setFiles({ gw360: null, sesi: [], premis: [] });
    setSaveStatus('');
    setAutosaveArmed(false);

    // Clear all file inputs in the DOM
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.value = '';
    });

    // Clear any "Uploaded" status messages by resetting the page display
    console.log('✅ Form reset complete - all fields and file inputs cleared');
  };

  // UPDATED: handleSubmit to include 'action' and 'reportType: maju'
  // In your laporan-maju.js, update the handleSubmit function's response handling:

  // In your laporan-maju.js handleSubmit function, make sure dataToSend is properly defined:

  // Form validation function
  const validateForm = () => {
    const errors = [];

    // For non-MIA submissions, check required fields
    if (!isMIA) {
      // 1. ✅ FIXED: Latar Belakang Usahawan is required ONLY for Sesi 1
      if (currentSessionNumber === 1) {
        if (!formData.LATARBELAKANG_USAHAWAN || formData.LATARBELAKANG_USAHAWAN.trim() === '') {
          errors.push('Latar Belakang Usahawan & Situasi Bisnes adalah wajib diisi');
        }
      }

      // 2. Minimum 1 Dapatan Sesi Mentoring with required fields
      if (!formData.MENTORING_FINDINGS_JSON || formData.MENTORING_FINDINGS_JSON.length === 0) {
        errors.push('Sekurang-kurangnya 1 Dapatan Sesi Mentoring diperlukan');
      } else {
        // Check each mentoring finding for required fields
        formData.MENTORING_FINDINGS_JSON.forEach((finding, index) => {
          if (!finding['Topik Perbincangan'] || finding['Topik Perbincangan'].trim() === '') {
            errors.push(`Dapatan Mentoring #${index + 1}: Topik Perbincangan adalah wajib`);
          }
          if (!finding['Hasil yang Diharapkan'] || finding['Hasil yang Diharapkan'].trim() === '') {
            errors.push(`Dapatan Mentoring #${index + 1}: Hasil yang Diharapkan adalah wajib`);
          }
          // Check minimum 1 action plan
          if (!finding['Pelan Tindakan'] || finding['Pelan Tindakan'].length === 0) {
            errors.push(`Dapatan Mentoring #${index + 1}: Sekurang-kurangnya 1 Pelan Tindakan diperlukan`);
          } else {
            // Check that at least one action plan has required fields
            const validActionPlans = finding['Pelan Tindakan'].filter(plan =>
              plan.Tindakan && plan.Tindakan.trim() !== ''
            );
            if (validActionPlans.length === 0) {
              errors.push(`Dapatan Mentoring #${index + 1}: Pelan Tindakan mesti mempunyai sekurang-kurangnya 1 tindakan yang diisi`);
            }
          }
        });
      }

      // 3. ✅ NEW: Previous action updates required for Sesi 2+ (Either Kemajuan OR Cabaran, not both)
      if (currentSessionNumber >= 2 && previousMentoringFindings.length > 0) {
        let missingUpdates = [];
        previousMentoringFindings.forEach((finding, findingIndex) => {
          if (finding['Pelan Tindakan'] && Array.isArray(finding['Pelan Tindakan'])) {
            finding['Pelan Tindakan'].forEach((plan, planIndex) => {
              const hasKemajuan = plan.Kemajuan && plan.Kemajuan.trim() !== '';
              const hasCabaran = plan.Cabaran && plan.Cabaran.trim() !== '';

              // Require at least ONE update (either Kemajuan OR Cabaran)
              if (!hasKemajuan && !hasCabaran) {
                missingUpdates.push(`Kemaskini samada Kemajuan atau Cabaran untuk "${plan.Tindakan || 'Tindakan ' + (planIndex + 1)}"`);
              }
            });
          }
        });
        if (missingUpdates.length > 0) {
          errors.push(`Sila kemaskini tindakan dari sesi sebelumnya: ${missingUpdates.join(', ')}`);
        }
      }

      // 4. ✅ NEW: Rumusan required for Sesi 2+
      if (currentSessionNumber >= 2) {
        if (!formData.RUMUSAN_DAN_LANGKAH_KEHADAPAN || formData.RUMUSAN_DAN_LANGKAH_KEHADAPAN.trim() === '') {
          errors.push('Rumusan Keseluruhan dan Langkah Kehadapan adalah wajib diisi untuk Sesi 2 ke atas');
        }
      }

      // 4. UPWARD MOBILITY validations (required for all sessions)
      // Section 3: Status & Mobiliti

      const umErrors = validateUpwardMobility(formData.UPWARD_MOBILITY, isMIA);
      if (umErrors.length > 0) {
        errors.push(...umErrors);
      }
    } else {
      // For MIA submissions, check MIA-specific requirements
      if (!miaReason || miaReason.trim() === '') {
        errors.push('Alasan/Sebab Usahawan MIA adalah wajib diisi');
      }
      if (!miaProofFile) {
        errors.push('Bukti MIA (screenshot/dokumen) adalah wajib dimuat naik');
      }
    }

    return errors;
  };

  // ✅ NEW: Build cumulative mentoring findings that include previous sessions with updates
  const buildCumulativeMentoringFindings = () => {
    let cumulativeFindings = [];

    // For Sesi 1, just return current findings
    if (currentSessionNumber === 1) {
      return formData.MENTORING_FINDINGS_JSON;
    }

    // For Sesi 2+, combine previous findings (with updates) + current findings
    if (previousMentoringFindings.length > 0) {
      // Add updated previous findings first
      const updatedPreviousFindings = previousMentoringFindings.map(finding => ({
        ...finding,
        // Mark these as being from previous session for document generation
        SessionOrigin: currentSessionNumber - 1,
        UpdatedInSession: currentSessionNumber
      }));
      cumulativeFindings = [...updatedPreviousFindings];
    }

    // Add current session's new findings
    const currentFindings = formData.MENTORING_FINDINGS_JSON.map(finding => ({
      ...finding,
      SessionOrigin: currentSessionNumber
    }));

    cumulativeFindings = [...cumulativeFindings, ...currentFindings];

    console.log(`📊 Built cumulative findings for Sesi ${currentSessionNumber}:`, {
      previousCount: previousMentoringFindings.length,
      currentCount: formData.MENTORING_FINDINGS_JSON.length,
      totalCount: cumulativeFindings.length
    });

    return cumulativeFindings;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Safety Check: Ensure session is valid
    if (status !== 'authenticated' || !session?.user) {
      setMessage('Sesi tidak sah atau telah tamat tempoh. Sila refresh page atau log masuk semula.');
      setMessageType('error');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // IMMEDIATELY disable button to prevent double-click
    if (loading) {
      console.warn('⚠️ Submission already in progress, ignoring duplicate click');
      return;
    }
    setLoading(true);

    // Validate form first
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      // Create a more user-friendly error message
      const errorMessage = `❌ Sila lengkapkan medan yang diperlukan (${validationErrors.length} isu):\n\n• ${validationErrors.join('\n• ')}`;
      setMessage(errorMessage);
      setMessageType('error');

      // Scroll to the top to show error message
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setLoading(false); // Re-enable button if validation fails
      return; // Stop submission if validation fails
    }

    setMessage('');
    setMessageType('');
    setSubmissionStage({ stage: 'preparing', message: 'Preparing submission...', detail: '' });

    console.log('🚀 Starting form submission...');

    try {
      // Image upload phase - process all images first
      console.log('📸 Starting batch image upload...');
      const imageUrls = { gw360: '', sesi: [], premis: [], mia: '' };
      const uploadPromises = [];

      // Count total files for logging
      const gw360Count = files.gw360 ? 1 : 0;
      const sesiCount = files.sesi ? files.sesi.length : 0;
      const premisCount = files.premis ? files.premis.length : 0;
      const miaCount = miaProofFile ? 1 : 0;

      console.log(`📊 Image URLs in submission:`);
      console.log(`  - Sesi Images: ${sesiCount}`);
      console.log(`  - Premis Images: ${premisCount}`);
      console.log(`  - GW360 Image: ${gw360Count ? 'Present' : 'Missing'}`);

      const folderId = formData.Folder_ID;
      const menteeNameForUpload = formData.NAMA_MENTEE;
      const sessionNumberForUpload = currentSessionNumber;

      // Check if we have images to upload
      const hasImagesToUpload = files.gw360 || (files.sesi && files.sesi.length > 0) || (files.premis && files.premis.length > 0) || miaProofFile;

      // Validate folderId before attempting uploads
      if (hasImagesToUpload && !folderId) {
        throw new Error(`Folder ID tidak ditemui untuk mentee: ${menteeNameForUpload}. Sila hubungi admin untuk menambah Folder ID dalam mapping sheet.`);
      }

      if (!hasImagesToUpload) {
        console.log('ℹ️ No images to upload, skipping upload phase');
      } else {
        console.log('📋 Folder ID:', folderId);
        console.log('📋 Mentee Name:', menteeNameForUpload);
      }

      // Upload images if we have any
      if (hasImagesToUpload) {
        // Upload GW360 image (single file)
        if (files.gw360) {
          uploadPromises.push(uploadImage(files.gw360, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => (imageUrls.gw360 = url)));
        }

        // Upload Sesi images (multiple files)
        if (files.sesi && files.sesi.length > 0) {
          files.sesi.forEach((file) => uploadPromises.push(uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => imageUrls.sesi.push(url))));
        }

        // Upload Premis images (multiple files)
        if (files.premis && files.premis.length > 0) {
          files.premis.forEach((file) => uploadPromises.push(uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => imageUrls.premis.push(url))));
        }

        // Upload MIA proof if present
        if (miaProofFile) {
          uploadPromises.push(uploadMiaProof(miaProofFile, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => (imageUrls.mia = url)));
        }

        // Wait for all uploads to complete
        if (uploadPromises.length > 0) {
          // Update stage: uploading images
          setSubmissionStage({
            stage: 'uploading',
            message: 'Uploading images to Google Drive...',
            detail: `Uploading ${uploadPromises.length} image${uploadPromises.length > 1 ? 's' : ''}`
          });

          console.log(`⏳ Waiting for ${uploadPromises.length} image uploads to complete...`);
          await Promise.all(uploadPromises);
          console.log('✅ All images uploaded successfully');
        }

        // Clear compression progress immediately when uploads complete
        setCompressionProgress({ show: false, current: 0, total: 0, message: '', fileName: '' });
      }

      // ✅ MAKE SURE dataToSend is declared in the correct scope
      let dataToSend = {}; // ← Declare it here at the top

      // CONDITIONALLY BUILD dataToSend BASED ON MIA STATUS
      if (isMIA) {
        console.log('📋 Building MIA data to send...');

        dataToSend = {
          NAMA_MENTOR: formData.NAMA_MENTOR,
          EMAIL_MENTOR: formData.EMAIL_MENTOR,
          NAMA_MENTEE: formData.NAMA_MENTEE,
          NAMA_BISNES: formData.NAMA_BISNES,
          SESI_NUMBER: currentSessionNumber,
          BATCH: formData.BATCH || '', // Added Batch
          PROGRAM: 'MAJU', // Added Program
          emel: formData.emel || '',
          LOKASI_BISNES: '',
          PRODUK_SERVIS: '',
          NO_TELEFON: '',
          TARIKH_SESI: '',
          MOD_SESI: '',
          LOKASI_F2F: '',
          MASA_MULA: '',
          MASA_TAMAT: '',
          LATARBELAKANG_USAHAWAN: '',
          DATA_KEWANGAN_BULANAN_JSON: [],
          MENTORING_FINDINGS_JSON: [],
          URL_GAMBAR_PREMIS_JSON: [],
          URL_GAMBAR_SESI_JSON: [],
          URL_GAMBAR_GW360: '',
          Folder_ID: formData.Folder_ID,
          Laporan_Maju_Doc_ID: '',
          STATUS_PERNIAGAAN_KESELURUHAN: '',
          RUMUSAN_DAN_LANGKAH_KEHADAPAN: '',
          MIA_STATUS: 'MIA',
          MIA_REASON: miaReason,
          MIA_PROOF_URL: imageUrls.mia,
          // UPWARD MOBILITY - Allow partial data for MIA submissions
          UPWARD_MOBILITY_JSON: JSON.stringify({
            UM_STATUS: formData.UPWARD_MOBILITY.UM_STATUS || '',
            UM_KRITERIA_IMPROVEMENT: formData.UPWARD_MOBILITY.UM_KRITERIA_IMPROVEMENT || '',
            UM_TARIKH_LAWATAN_PREMIS: formData.UPWARD_MOBILITY.UM_TARIKH_LAWATAN_PREMIS || '',
            UM_AKAUN_BIMB: formData.UPWARD_MOBILITY.UM_AKAUN_BIMB || '',
            UM_BIMB_BIZ: formData.UPWARD_MOBILITY.UM_BIMB_BIZ || '',
            UM_AL_AWFAR: formData.UPWARD_MOBILITY.UM_AL_AWFAR || '',
            UM_MERCHANT_TERMINAL: formData.UPWARD_MOBILITY.UM_MERCHANT_TERMINAL || '',
            UM_FASILITI_LAIN: formData.UPWARD_MOBILITY.UM_FASILITI_LAIN || '',
            UM_MESINKIRA: formData.UPWARD_MOBILITY.UM_MESINKIRA || '',
            UM_PENDAPATAN_SEMASA: formData.UPWARD_MOBILITY.UM_PENDAPATAN_SEMASA || '',
            UM_ULASAN_PENDAPATAN: formData.UPWARD_MOBILITY.UM_ULASAN_PENDAPATAN || '',
            UM_PEKERJA_SEMASA: formData.UPWARD_MOBILITY.UM_PEKERJA_SEMASA || '',
            UM_ULASAN_PEKERJA: formData.UPWARD_MOBILITY.UM_ULASAN_PEKERJA || '',
            UM_ASET_BUKAN_TUNAI_SEMASA: formData.UPWARD_MOBILITY.UM_ASET_BUKAN_TUNAI_SEMASA || '',
            UM_ULASAN_ASET_BUKAN_TUNAI: formData.UPWARD_MOBILITY.UM_ULASAN_ASET_BUKAN_TUNAI || '',
            UM_ASET_TUNAI_SEMASA: formData.UPWARD_MOBILITY.UM_ASET_TUNAI_SEMASA || '',
            UM_ULASAN_ASET_TUNAI: formData.UPWARD_MOBILITY.UM_ULASAN_ASET_TUNAI || '',
            UM_SIMPANAN_SEMASA: formData.UPWARD_MOBILITY.UM_SIMPANAN_SEMASA || '',
            UM_ULASAN_SIMPANAN: formData.UPWARD_MOBILITY.UM_ULASAN_SIMPANAN || '',
            UM_ZAKAT_SEMASA: formData.UPWARD_MOBILITY.UM_ZAKAT_SEMASA || '',
            UM_ULASAN_ZAKAT: formData.UPWARD_MOBILITY.UM_ULASAN_ZAKAT || '',
            UM_DIGITAL_SEMASA: (formData.UPWARD_MOBILITY.UM_DIGITAL_SEMASA || []).join(', '),
            UM_ULASAN_DIGITAL: formData.UPWARD_MOBILITY.UM_ULASAN_DIGITAL || '',
            UM_MARKETING_SEMASA: (formData.UPWARD_MOBILITY.UM_MARKETING_SEMASA || []).join(', '),
            UM_ULASAN_MARKETING: formData.UPWARD_MOBILITY.UM_ULASAN_MARKETING || '',
          }),
        };
      } else {
        console.log('📋 Building regular report data to send...');

        dataToSend = {
          NAMA_MENTOR: formData.NAMA_MENTOR,
          EMAIL_MENTOR: formData.EMAIL_MENTOR,
          NAMA_MENTEE: formData.NAMA_MENTEE,
          NAMA_BISNES: formData.NAMA_BISNES,
          SESI_NUMBER: currentSessionNumber,
          BATCH: formData.BATCH || '', // Added Batch
          PROGRAM: 'MAJU', // Added Program
          emel: formData.emel || '',
          LOKASI_BISNES: formData.LOKASI_BISNES,
          PRODUK_SERVIS: formData.PRODUK_SERVIS,
          NO_TELEFON: formData.NO_TELEFON,
          TARIKH_SESI: formData.TARIKH_SESI,
          MOD_SESI: formData.MOD_SESI,
          LOKASI_F2F: formData.LOKASI_F2F,
          MASA_MULA: formData.MASA_MULA,
          MASA_TAMAT: formData.MASA_TAMAT,
          LATARBELAKANG_USAHAWAN: currentSessionNumber === 1 ? formData.LATARBELAKANG_USAHAWAN : previousLatarBelakangUsahawan,
          DATA_KEWANGAN_BULANAN_JSON: formData.DATA_KEWANGAN_BULANAN_JSON,
          MENTORING_FINDINGS_JSON: buildCumulativeMentoringFindings(),
          URL_GAMBAR_PREMIS_JSON: imageUrls.premis,
          URL_GAMBAR_SESI_JSON: imageUrls.sesi,
          URL_GAMBAR_GW360: imageUrls.gw360,
          Folder_ID: formData.Folder_ID,
          Laporan_Maju_Doc_ID: '',
          STATUS_PERNIAGAAN_KESELURUHAN: formData.STATUS_PERNIAGAAN_KESELURUHAN || '',
          RUMUSAN_DAN_LANGKAH_KEHADAPAN: formData.RUMUSAN_DAN_LANGKAH_KEHADAPAN || '',
          MIA_STATUS: 'Tidak MIA',
          MIA_REASON: '',
          MIA_PROOF_URL: imageUrls.mia,
          // UPWARD MOBILITY - Store as JSON for MAJU AppScript
          UPWARD_MOBILITY_JSON: JSON.stringify({
            UM_STATUS: formData.UPWARD_MOBILITY.UM_STATUS || '',
            UM_KRITERIA_IMPROVEMENT: formData.UPWARD_MOBILITY.UM_KRITERIA_IMPROVEMENT || '',
            UM_TARIKH_LAWATAN_PREMIS: formData.UPWARD_MOBILITY.UM_TARIKH_LAWATAN_PREMIS || '',
            UM_AKAUN_BIMB: formData.UPWARD_MOBILITY.UM_AKAUN_BIMB || '',
            UM_BIMB_BIZ: formData.UPWARD_MOBILITY.UM_BIMB_BIZ || '',
            UM_AL_AWFAR: formData.UPWARD_MOBILITY.UM_AL_AWFAR || '',
            UM_MERCHANT_TERMINAL: formData.UPWARD_MOBILITY.UM_MERCHANT_TERMINAL || '',
            UM_FASILITI_LAIN: formData.UPWARD_MOBILITY.UM_FASILITI_LAIN || '',
            UM_MESINKIRA: formData.UPWARD_MOBILITY.UM_MESINKIRA || '',
            UM_PENDAPATAN_SEMASA: formData.UPWARD_MOBILITY.UM_PENDAPATAN_SEMASA || '',
            UM_ULASAN_PENDAPATAN: formData.UPWARD_MOBILITY.UM_ULASAN_PENDAPATAN || '',
            UM_PEKERJA_SEMASA: formData.UPWARD_MOBILITY.UM_PEKERJA_SEMASA || '',
            UM_ULASAN_PEKERJA: formData.UPWARD_MOBILITY.UM_ULASAN_PEKERJA || '',
            UM_ASET_BUKAN_TUNAI_SEMASA: formData.UPWARD_MOBILITY.UM_ASET_BUKAN_TUNAI_SEMASA || '',
            UM_ULASAN_ASET_BUKAN_TUNAI: formData.UPWARD_MOBILITY.UM_ULASAN_ASET_BUKAN_TUNAI || '',
            UM_ASET_TUNAI_SEMASA: formData.UPWARD_MOBILITY.UM_ASET_TUNAI_SEMASA || '',
            UM_ULASAN_ASET_TUNAI: formData.UPWARD_MOBILITY.UM_ULASAN_ASET_TUNAI || '',
            UM_SIMPANAN_SEMASA: formData.UPWARD_MOBILITY.UM_SIMPANAN_SEMASA || '',
            UM_ULASAN_SIMPANAN: formData.UPWARD_MOBILITY.UM_ULASAN_SIMPANAN || '',
            UM_ZAKAT_SEMASA: formData.UPWARD_MOBILITY.UM_ZAKAT_SEMASA || '',
            UM_ULASAN_ZAKAT: formData.UPWARD_MOBILITY.UM_ULASAN_ZAKAT || '',
            UM_DIGITAL_SEMASA: (formData.UPWARD_MOBILITY.UM_DIGITAL_SEMASA || []).join(', '),
            UM_ULASAN_DIGITAL: formData.UPWARD_MOBILITY.UM_ULASAN_DIGITAL || '',
            UM_MARKETING_SEMASA: (formData.UPWARD_MOBILITY.UM_MARKETING_SEMASA || []).join(', '),
            UM_ULASAN_MARKETING: formData.UPWARD_MOBILITY.UM_ULASAN_MARKETING || '',
          }),
        };
      }

      // ✅ Now dataToSend is properly defined and can be used
      console.log('📤 Data to send:', dataToSend);

      // DEBUG: Check if images are present
      console.log('🖼️ Image URLs in submission:');
      console.log('  - Sesi Images:', dataToSend.URL_GAMBAR_SESI_JSON?.length || 0);
      console.log('  - Premis Images:', dataToSend.URL_GAMBAR_PREMIS_JSON?.length || 0);
      console.log('  - GW360 Image:', dataToSend.URL_GAMBAR_GW360 ? 'Present' : 'Missing');

      console.log('🌐 Submitting to /api/submitMajuReportum...');

      // Update stage: saving to database
      setSubmissionStage({
        stage: 'saving',
        message: 'Saving report to Google Sheets & Upward Mobility...',
        detail: 'Writing to MAJU and UM sheets. This may take up to 40 seconds'
      });

      // Add frontend timeout protection (35 seconds for dual AppScript calls)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      let response;
      try {
        response = await fetch('/api/submitMajuReportum', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSend),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          throw new Error('⏱️ Request timeout - sila cuba lagi. Jika masalah berterusan, hubungi admin.');
        }
        throw fetchError;
      }

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      // Safe JSON parsing with fallback
      let result;
      const contentType = response.headers.get('content-type');

      try {
        if (contentType && contentType.includes('application/json')) {
          result = await response.json();
          console.log('📄 Parsed response JSON:', result);
        } else {
          // Response is not JSON (likely HTML error page)
          const text = await response.text();
          console.error('❌ Non-JSON response:', text.substring(0, 200));
          result = {
            error: 'Server returned unexpected response. Please check Google Sheet to verify if report was saved.',
            retryable: false,
            serverResponse: text.substring(0, 200)
          };
        }
      } catch (parseError) {
        console.error('❌ Failed to parse response:', parseError);
        result = {
          error: 'Unable to read server response. Please check Google Sheet to verify if report was saved.',
          retryable: false
        };
      }

      // Enhanced error message based on status code
      if (!response.ok) {
        let userMessage = result.error || result.message;

        if (response.status === 504) {
          userMessage = `⏱️ Server timeout - your images were uploaded, but we couldn't confirm if data was saved.\n\n` +
            `✓ Check Google Sheet to see if your report appears\n` +
            `✗ DO NOT submit again without checking\n` +
            `📞 Contact admin if report is missing`;
        } else if (response.status === 408) {
          userMessage = `${result.error || 'Request timeout'}\n\nYou can try submitting again.`;
        }

        if (result.retryable) {
          throw new Error(`${userMessage} (Boleh cuba semula)`);
        }
        throw new Error(userMessage);
      }

      // Handle success
      if (response.ok && result.success === true) {
        console.log('✅ [PHASE 5] Submission successful!');
        console.log('📋 [PHASE 5] Success message:', result.message);

        if (result.docUrl) {
          console.log('📄 [PHASE 5] Document URL:', result.docUrl);
        }

        // ============================================================
        // ⚠️ REMOVED: STANDALONE UM SHEET WRITE (NOW HANDLED BY BACKEND)
        // ============================================================
        // The backend submitMajuReportum.js already writes to UM sheet
        // as part of the main submission flow (matching Bangkit implementation).
        // This frontend call to /api/submit-upward-mobility was causing
        // duplicate entries in the UM tab.
        //
        // For parity with Bangkit:
        // ✅ UM write happens INSIDE submitMajuReportum.js
        // ❌ No separate call to /api/submit-upward-mobility
        //
        // Note: /api/submit-upward-mobility is a STANDALONE endpoint
        // for optional UM-only submissions (not linked to session reports).
        // ============================================================
        console.log('ℹ️ [PHASE 6] UM write handled by backend (no duplicate call)');

        // Update stage: complete
        setSubmissionStage({
          stage: 'complete',
          message: 'Report submitted successfully!',
          detail: ''
        });

        // Show Receipt Modal
        const receiptData = {
          submissionId: result?.dualWrite?.supabaseReports?.recordId || `ROW-${result?.rowNumber || 'UNKNOWN'}`,
          submittedAt: new Date().toISOString(),
          menteeName: formData.NAMA_MENTEE || 'Usahawan',
          sessionNumber: currentSessionNumber,
          program: 'Maju & Upward Mobility'
        };
        setSubmissionResult(receiptData);
        setIsReceiptModalOpen(true);

        // Clear saved draft before resetting
        try {
          const draftKey = getDraftKey(
            formData.NAMA_MENTEE,
            currentSessionNumber,
            session?.user?.email
          );
          localStorage.removeItem(draftKey);
          console.log('🗑️ [PHASE 5] Draft cleared after successful submission');
        } catch (error) {
          console.error('Failed to clear draft:', error);
        }

        console.log('🔄 [PHASE 5] Resetting form...');
        resetForm();
        setSubmissionStage({ stage: '', message: '', detail: '' }); // Clear stage after reset
        setMessage(''); // Clear inline message

        console.log('✅ [COMPLETE] Submission process completed successfully');
        return;

      } else if (result.partialSuccess) {
        // Handle partial success (sheet saved but document failed)
        console.warn('⚠️ [PHASE 5] Partial success - sheet saved but document failed');

        // Update stage: show warning
        setSubmissionStage({
          stage: 'warning',
          message: 'Data saved but document generation timed out',
          detail: 'Check the warning message below'
        });

        const partialMessage = `⚠️ ${result.error || 'Laporan separa berjaya'}\n\n` +
          `✅ Data telah disimpan di Google Sheet\n` +
          `❌ Dokumen gagal dicipta\n\n` +
          `📊 Row Number: ${result.rowNumber}\n` +
          `📝 Details: ${result.warning || result.message}\n\n` +
          `💡 Sila hubungi admin dengan nombor row di atas untuk mencipta dokumen.`;

        setMessage(partialMessage);
        setMessageType('warning');

        // Don't reset form completely - user might need to see data
        console.log('⚠️ [PHASE 5] Partial success - form not reset');
        // Don't return early - let finally block clear loading state

      } else {
        // Failure case
        console.error('❌ [PHASE 5] Submission failed');
        console.error('📊 [PHASE 5] Response status:', response.status);
        console.error('📊 [PHASE 5] Result object:', result);

        const errorMessage = result.error || result.message || 'Unknown error occurred';
        const errorDetails = result.details || '';
        const warningInfo = result.warning ? `\n⚠️ Warning: ${result.warning}` : '';
        const rowInfo = result.rowNumber ? `\n📊 Row Number: ${result.rowNumber}` : '';

        console.error('❌ [PHASE 5] Error message:', errorMessage);
        if (errorDetails) {
          console.error('❌ [PHASE 5] Error details:', errorDetails);
        }

        throw new Error(`${errorMessage}${warningInfo}${errorDetails ? '\n\nDetails: ' + errorDetails : ''}${rowInfo}`);
      }

    } catch (error) {
      console.error('❌ Detailed submission error:', error);

      // Determine stage-specific error message
      let errorMessage = error.message;
      let errorDetail = '';

      if (submissionStage.stage === 'uploading') {
        errorMessage = `❌ Image upload failed: ${error.message}`;
        errorDetail = 'Check your internet connection and try again.';
      } else if (submissionStage.stage === 'saving') {
        errorMessage = `⚠️ ${error.message}`;
        errorDetail = '';
      }

      setSubmissionStage({
        stage: 'error',
        message: errorMessage,
        detail: errorDetail
      });

      setMessage(`Failed to submit Laporan: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };
  // Early returns for authentication and session limits
  if (!session) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to access Laporan MAJU/UM.</p>
          <button
            onClick={() => signIn('google')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-sm font-medium transition-colors"
          >
            Login with Google
          </button>
        </div>
      </div>
    );
  }

  if (currentSessionNumber > 4 && formData.NAMA_MENTEE) {
    return (
      <div className="bg-gray-100 min-h-screen font-sans">
        <header className="text-center bg-white p-6 rounded-lg shadow-sm mb-6 max-w-4xl mx-auto">
          <img src="/logo1.png" alt="Logo" className="mx-auto h-20 mb-2" />
          <h1 className="text-3xl font-bold text-gray-800">Borang Laporan Maju</h1>
          <p className="text-gray-500 mt-1">Sila lengkapkan borang berdasarkan sesi semasa.</p>
        </header>

        <div className="container mx-auto p-4 max-w-4xl">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <InfoCard title="Sesi Mentoring Lengkap" type="info">
              <p className="text-lg">
                Semua sesi mentoring untuk <strong>{formData.NAMA_MENTEE}</strong> telah lengkap (Sesi 1 hingga 4 telah direkodkan).
                <br />
                Tiada borang laporan maju baru diperlukan untuk mentee ini.
              </p>
              <button
                onClick={resetForm}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Pilih Mentee Lain
              </button>
            </InfoCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      {/* Navigation Breadcrumb */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center space-x-2 text-sm">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </a>
            <span className="text-gray-400">/</span>
            <a
              href="/mentor/dashboard"
              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Mentor Dashboard
            </a>
            <span className="text-gray-400">/</span>
            <span className="text-gray-700 font-medium">Laporan Maju + UM</span>
          </div>
        </div>
      </nav>

      {/* Header: white card with logo + title */}
      <header className="text-center bg-white p-6 rounded-lg shadow-sm mb-6 max-w-4xl mx-auto mt-6">
        <img src="/logo1.png" alt="Logo" className="mx-auto h-20 mb-2" />
        <h1 className="text-3xl font-bold text-gray-800">Borang Laporan Maju + Upward Mobility</h1>
        <p className="text-gray-500 mt-1">Sila lengkapkan borang berdasarkan sesi semasa.</p>
      </header>

      {/* Main content */}
      <div className="container mx-auto p-4 max-w-4xl space-y-6">
        {/* Message / Loading (as cards for consistency) */}
        {message && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <InfoCard
              title={
                messageType === 'success' ? 'Success' :
                  messageType === 'warning' ? 'Partial Success' :
                    'Error'
              }
              type={messageType}
            >
              <div style={{ whiteSpace: 'pre-line' }}>{message}</div>
            </InfoCard>
          </div>
        )}

        {loading && (
          <div className="bg-white p-6 rounded-lg shadow-sm text-center">
            <p className="text-blue-500">Loading...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* MIA Checkbox always visible at the top */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            {isMIA && formData.NAMA_MENTEE && (
              <InfoCard title="Usahawan ini telah ditandakan sebagai MIA." type="info">
                <p>Anda hanya boleh menghantar laporan MIA untuk mentee ini.</p>
                <p>Sila nyatakan alasan dan muat naik bukti.</p>
              </InfoCard>
            )}
            <label className="flex items-center mt-4">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-red-600"
                checked={isMIA}
                onChange={(e) => setIsMIA(e.target.checked)}
                disabled={isMIA && (formData.NAMA_MENTEE && currentSessionNumber > 1)}
              />
              <span className="ml-2 text-lg font-semibold text-gray-800">Tandakan jika Usahawan Tidak Hadir / MIA</span>
            </label>
          </div>

          {/* Conditional rendering based on isMIA status */}
          {isMIA ? (
            /* MIA Form Section */
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <Section title="Laporan Status MIA">
                <InputField
                  label="Nama Mentee"
                  name="NAMA_MENTEE"
                  value={formData.NAMA_MENTEE}
                  disabled
                />
                <InputField
                  label="Nombor Sesi"
                  name="SESI_NUMBER_DISPLAY"
                  value={`Sesi #${currentSessionNumber}`}
                  disabled
                />
                <TextArea
                  label="Alasan / Sebab Usahawan MIA"
                  name="miaReason"
                  value={miaReason}
                  onChange={(e) => setMiaReason(e.target.value)}
                  required
                  rows={4}
                  placeholder="Cth: Telah dihubungi 3 kali melalui WhatsApp pada 01/08/2025, tiada jawapan."
                />
                <FileInput
                  label="Muat Naik Bukti (Cth: Screenshot Perbualan)"
                  name="miaProof"
                  onFileChange={handleMiaProofFileChange} // <--- Ensure this uses the new handler
                  multiple={false}
                />
                {miaProofFile && (
                  <div className="mt-2 text-sm text-gray-600">
                    File selected: {miaProofFile.name}
                  </div>
                )}
              </Section>
            </div>
          ) : (
            <>
              {/* --- Maklumat Sesi --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Maklumat Sesi">
                  {isAdmin && (
                    <SelectField
                      label="Pilih Mentor"
                      name="mentorSelection"
                      value={selectedMentorEmail}
                      onChange={(e) => setSelectedMentorEmail(e.target.value)}
                      options={mentorsInMapping}
                      required
                    />
                  )}
                  <InputField label="Nama Mentor" name="NAMA_MENTOR" value={formData.NAMA_MENTOR} disabled />
                  <SelectField
                    label="Nama Mentee"
                    name="NAMA_MENTEE"
                    value={formData.NAMA_MENTEE}
                    onChange={handleMenteeSelect}
                    options={[
                      { label: 'Pilih Mentee', value: '' },
                      ...filteredMenteesForDropdown.map(m => ({ label: m.Usahawan, value: m.Usahawan })),
                    ]}
                    required
                  />
                  <InputField label="Nama Bisnes" name="NAMA_BISNES" value={formData.NAMA_BISNES} disabled />
                  <InputField label="Lokasi Bisnes" name="LOKASI_BISNES" value={formData.LOKASI_BISNES} disabled />
                  <InputField label="Produk/Servis" name="PRODUK_SERVIS" value={formData.PRODUK_SERVIS} disabled />
                  <InputField label="No Telefon Mentee" name="NO_TELEFON" value={formData.NO_TELEFON} disabled />
                  <InputField
                    label="Tarikh Sesi"
                    name="TARIKH_SESI"
                    type="date"
                    value={formData.TARIKH_SESI}
                    onChange={handleChange}
                    required
                  />
                  <InputField label="Nombor Sesi" name="SESI_NUMBER_DISPLAY" value={`Sesi #${currentSessionNumber}`} disabled />
                  <SelectField
                    label="Mod Sesi"
                    name="MOD_SESI"
                    value={formData.MOD_SESI}
                    onChange={handleChange}
                    options={[
                      { label: 'Pilih Mod Sesi', value: '' },
                      { label: 'Face to Face', value: 'Face to Face' },
                      { label: 'Online', value: 'Online' },
                    ]}
                    required
                  />
                  {formData.MOD_SESI === 'Face to Face' && (
                    <InputField
                      label="Lokasi F2F"
                      name="LOKASI_F2F"
                      value={formData.LOKASI_F2F}
                      onChange={handleChange}
                      required
                    />
                  )}
                  <InputField
                    label="Masa Mula"
                    name="MASA_MULA"
                    type="time"
                    value={formData.MASA_MULA}
                    onChange={handleChange}
                    required
                  />
                  <InputField
                    label="Masa Tamat"
                    name="MASA_TAMAT"
                    type="time"
                    value={formData.MASA_TAMAT}
                    onChange={handleChange}
                    required
                  />
                </Section>
              </div>

              {/* --- Enhanced Latar Belakang Section --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Latar Belakang Usahawan & Situasi Bisnes *">
                  {currentSessionNumber === 1 ? (
                    <EnhancedTextArea
                      label="Latar Belakang Usahawan"
                      name="LATARBELAKANG_USAHAWAN"
                      value={formData.LATARBELAKANG_USAHAWAN}
                      onChange={handleChange}
                      required={true}
                      rows={8}
                      helperText={`Panduan:
Latarbelakang usahawan.
Penerangan produk/perkhidmatan.
Situasi bisnes ketika ini:
- Sistem bisnes
- Sejauh mana usahawan jelas dengan segmen pelanggan dan nilai yang ditawarkan
- Aktiviti pemasaran dan jualan
- Perekodan maklumat akaun, sistem yang digunakan
Apa yang usahawan mahu capai kedepan.
Pemerhatian Mentor/Coach (apa yang bagus, apa yang kurang dan boleh ditambahbaik oleh usahawan)
Kenalpasti bahagian yang boleh nampak peningkatan sebelum dan selepas setahun lalui program:
- Pendapatan
- Keuntungan
- Penambahan pekerja
- Adaptasi teknologi
- Peningkatan skil/pengetahuan`}
                    />
                  ) : (
                    <TextArea
                      label="Latar Belakang Usahawan (Dari Sesi 1)"
                      name="LATARBELAKANG_USAHAWAN"
                      value={previousLatarBelakangUsahawan}
                      disabled={true}
                      rows={5}
                      placeholder="Latar Belakang Usahawan can only be edited in Sesi 1. Displaying previous entry."
                    />
                  )}
                </Section>
              </div>

              {/* --- Data Kewangan Bulanan --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Data Kewangan Bulanan">
                  {formData.DATA_KEWANGAN_BULANAN_JSON.map((data, index) => {
                    // Generate dynamic year options (current year and previous 2 years)
                    const currentYear = new Date().getFullYear();
                    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];
                    const monthOptions = [
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ];

                    // Parse existing Bulan value (e.g., "January 2024" or handle legacy formats)
                    const bulanParts = (data.Bulan || '').split(' ');
                    const selectedMonth = bulanParts[0] || '';
                    const selectedYear = bulanParts[1] || currentYear.toString();

                    return (
                      <div key={index} className="border p-4 mb-4 rounded-md bg-gray-50">
                        <h4 className="font-semibold text-gray-700 mb-2">Bulan #{index + 1}</h4>

                        {/* Month and Year Dropdowns Side by Side */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bulan
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <select
                                name="Month"
                                value={selectedMonth}
                                onChange={(e) => {
                                  const newBulan = `${e.target.value} ${selectedYear}`;
                                  handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Bulan', newBulan);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                              >
                                <option value="">Select Month</option>
                                {monthOptions.map((month) => (
                                  <option key={month} value={month}>{month}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <select
                                name="Year"
                                value={selectedYear}
                                onChange={(e) => {
                                  const newBulan = `${selectedMonth} ${e.target.value}`;
                                  handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Bulan', newBulan);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                              >
                                <option value="">Select Year</option>
                                {yearOptions.map((year) => (
                                  <option key={year} value={year}>{year}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <InputField
                          label="Jumlah Jualan (RM)"
                          name="Jumlah Jualan"
                          type="number"
                          value={data['Jumlah Jualan'] || ''}
                          onChange={(e) =>
                            handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Jumlah Jualan', parseFloat(e.target.value) || 0)
                          }
                        />
                        <InputField
                          label="Kos Jualan (RM)"
                          name="Kos Jualan"
                          type="number"
                          value={data['Kos Jualan'] || ''}
                          onChange={(e) =>
                            handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Kos Jualan', parseFloat(e.target.value) || 0)
                          }
                        />
                        <InputField
                          label="Perbelanjaan Tetap (RM)"
                          name="Perbelanjaan Tetap"
                          type="number"
                          value={data['Perbelanjaan Tetap'] || ''}
                          onChange={(e) =>
                            handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Perbelanjaan Tetap', parseFloat(e.target.value) || 0)
                          }
                        />
                        <InputField
                          label="Lebihan Tunai (RM)"
                          name="Lebihan Tunai"
                          type="number"
                          value={data['Lebihan Tunai'] || ''}
                          onChange={(e) =>
                            handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Lebihan Tunai', parseFloat(e.target.value) || 0)
                          }
                        />
                        <TextArea
                          label="Ulasan Mentor"
                          name="Ulasan Mentor"
                          value={data['Ulasan Mentor'] || ''}
                          onChange={(e) =>
                            handleDynamicChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Ulasan Mentor', e.target.value)
                          }
                          rows={2}
                        />
                        <button
                          type="button"
                          onClick={() => removeRow('DATA_KEWANGAN_BULANAN_JSON', index)}
                          className="mt-2 bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                        >
                          Remove Bulan
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      addRow('DATA_KEWANGAN_BULANAN_JSON', {
                        Bulan: '',
                        'Jumlah Jualan': '',
                        'Kos Jualan': '',
                        'Perbelanjaan Tetap': '',
                        'Lebihan Tunai': '',
                        'Ulasan Mentor': '',
                      })
                    }
                    className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                  >
                    Add Bulan Data
                  </button>
                </Section>
              </div>

              {/* --- Keputusan Mentee - Inisiatif yang mahu diambil --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Keputusan Mentee - Inisiatif yang mahu diambil *">
                  <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r">
                    <p className="text-sm text-blue-800">
                      <strong>Required:</strong> Minimum 1 Topik Perbincangan dengan sekurang-kurangnya 1 Pelan Tindakan yang lengkap.
                    </p>
                  </div>
                  {currentSessionNumber > 1 && previousMentoringFindings.length > 0 && (
                    <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                      <h3 className="text-lg font-semibold text-blue-800 mb-4">
                        📋 Kemaskini Tindakan dari Sesi Sebelumnya (Sesi #{currentSessionNumber - 1})
                      </h3>
                      <p className="text-sm text-blue-700 mb-4">
                        <strong>Sila pilih untuk kemaskini:</strong> Samada <em>Kemajuan</em> (jika ada progress) atau <em>Cabaran</em> (jika ada halangan) untuk setiap tindakan. Tidak perlu isi kedua-duanya.
                      </p>

                      {previousMentoringFindings.map((finding, findingIndex) => (
                        finding['Pelan Tindakan'] && Array.isArray(finding['Pelan Tindakan']) && finding['Pelan Tindakan'].length > 0 && (
                          <div key={findingIndex} className="bg-white p-4 mb-4 rounded-lg border">
                            <h4 className="font-semibold text-gray-800 mb-3">
                              Topik: {finding['Topik Perbincangan']}
                            </h4>
                            <p className="text-sm text-gray-600 mb-4">
                              Hasil Diharapkan: {finding['Hasil yang Diharapkan']}
                            </p>

                            {finding['Pelan Tindakan'].map((plan, planIndex) => (
                              <div key={planIndex} className="bg-gray-50 p-3 mb-3 rounded border-l-4 border-orange-400">
                                <div className="mb-2">
                                  <span className="font-medium text-gray-700">Tindakan:</span>
                                  <p className="text-gray-800">{plan.Tindakan}</p>
                                  <p className="text-sm text-gray-600">
                                    Jangkaan Siap: {plan['Jangkaan tarikh siap'] || 'N/A'}
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                  <TextArea
                                    label="✅ Kemajuan (Progress) - Pilihan 1"
                                    name={`kemajuan_${findingIndex}_${planIndex}`}
                                    value={plan.Kemajuan || ''}
                                    onChange={(e) => {
                                      const updatedFindings = [...previousMentoringFindings];
                                      if (!updatedFindings[findingIndex]['Pelan Tindakan'][planIndex].Kemajuan) {
                                        updatedFindings[findingIndex]['Pelan Tindakan'][planIndex].Kemajuan = '';
                                      }
                                      updatedFindings[findingIndex]['Pelan Tindakan'][planIndex].Kemajuan = e.target.value;
                                      setPreviousMentoringFindings(updatedFindings);
                                    }}
                                    rows={3}
                                    placeholder="Pilih ini jika ada kemajuan untuk tindakan ini..."
                                  />

                                  <TextArea
                                    label="⚠️ Cabaran (Challenges) - Pilihan 2"
                                    name={`cabaran_${findingIndex}_${planIndex}`}
                                    value={plan.Cabaran || ''}
                                    onChange={(e) => {
                                      const updatedFindings = [...previousMentoringFindings];
                                      if (!updatedFindings[findingIndex]['Pelan Tindakan'][planIndex].Cabaran) {
                                        updatedFindings[findingIndex]['Pelan Tindakan'][planIndex].Cabaran = '';
                                      }
                                      updatedFindings[findingIndex]['Pelan Tindakan'][planIndex].Cabaran = e.target.value;
                                      setPreviousMentoringFindings(updatedFindings);
                                    }}
                                    rows={3}
                                    placeholder="Pilih ini jika ada cabaran atau halangan yang dihadapi..."
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ))}

                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm text-yellow-800">
                          💡 <strong>Tip:</strong> Kemaskini progress dan cabaran ini akan dimasukkan ke dalam dokumen laporan untuk menunjukkan perkembangan dari sesi ke sesi.
                        </p>
                      </div>
                    </div>
                  )}

                  {formData.MENTORING_FINDINGS_JSON.map((finding, index) => (
                    <div key={index} className="border p-4 mb-4 rounded-md bg-gray-50">
                      <h4 className="font-semibold text-gray-700 mb-2">Dapatan Mentoring #{index + 1}</h4>
                      <InputField
                        label="Topik Perbincangan"
                        name="Topik Perbincangan"
                        value={finding['Topik Perbincangan'] || ''}
                        onChange={(e) => handleDynamicChange('MENTORING_FINDINGS_JSON', index, 'Topik Perbincangan', e.target.value)}
                      />
                      <InputField
                        label="Hasil yang Diharapkan"
                        name="Hasil yang Diharapkan"
                        value={finding['Hasil yang Diharapkan'] || ''}
                        onChange={(e) => handleDynamicChange('MENTORING_FINDINGS_JSON', index, 'Hasil yang Diharapkan', e.target.value)}
                      />

                      <h5 className="font-semibold mt-4 mb-2">Pelan Tindakan</h5>
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm text-blue-800">
                          <strong>Nota:</strong> Kemajuan dan Cabaran untuk tindakan ini akan dikemaskini dalam sesi akan datang.
                        </p>
                      </div>
                      {(finding['Pelan Tindakan'] || []).map((plan, pIndex) => (
                        <div key={pIndex} className="border p-3 mb-2 rounded-md bg-gray-100">
                          <InputField
                            label="Tindakan"
                            name="Tindakan"
                            value={plan.Tindakan || ''}
                            onChange={(e) => {
                              const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                              if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                              updatedFindings[index]['Pelan Tindakan'][pIndex].Tindakan = e.target.value;
                              setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                            }}
                          />
                          <InputField
                            label="Jangkaan Tarikh Siap"
                            name="Jangkaan tarikh siap"
                            type="date"
                            value={plan['Jangkaan tarikh siap'] || ''}
                            onChange={(e) => {
                              const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                              if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                              updatedFindings[index]['Pelan Tindakan'][pIndex]['Jangkaan tarikh siap'] = e.target.value;
                              setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                            }}
                          />
                          <TextArea
                            label="Catatan"
                            name="Catatan"
                            value={plan.Catatan || ''}
                            onChange={(e) => {
                              const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                              if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                              updatedFindings[index]['Pelan Tindakan'][pIndex].Catatan = e.target.value;
                              setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                            }}
                            rows={2}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                              if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                              updatedFindings[index]['Pelan Tindakan'] =
                                updatedFindings[index]['Pelan Tindakan'].filter((_, i) => i !== pIndex);
                              setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                            }}
                            className="mt-2 bg-red-400 text-white px-2 py-1 rounded-md text-xs hover:bg-red-500"
                          >
                            Remove Pelan Tindakan
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updatedFindings = [...formData.MENTORING_FINDINGS_JSON];
                          if (!updatedFindings[index]) {
                            updatedFindings[index] = {
                              'Topik Perbincangan': '',
                              'Hasil yang Diharapkan': '',
                              'Kemajuan Mentee': '',
                              'Cabaran dan Halangan Mentee': '',
                              'Pelan Tindakan': [],
                            };
                          }
                          if (!updatedFindings[index]['Pelan Tindakan']) {
                            updatedFindings[index]['Pelan Tindakan'] = [];
                          }
                          updatedFindings[index]['Pelan Tindakan'].push({
                            Tindakan: '',
                            'Jangkaan tarikh siap': '',
                            Catatan: '',
                          });
                          setFormData(prev => ({ ...prev, MENTORING_FINDINGS_JSON: updatedFindings }));
                        }}
                        className="mt-2 bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600"
                      >
                        Add Pelan Tindakan
                      </button>

                      <button
                        type="button"
                        onClick={() => removeRow('MENTORING_FINDINGS_JSON', index)}
                        className="mt-4 bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                      >
                        Remove Dapatan Mentoring
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      addRow('MENTORING_FINDINGS_JSON', {
                        'Topik Perbincangan': '',
                        'Hasil yang Diharapkan': '',
                        'Pelan Tindakan': [],
                      })
                    }
                    className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                  >
                    Add Dapatan Mentoring
                  </button>
                </Section>
              </div>

              {/* --- NEW Rumusan & Langkah Kehadapan Section (Sesi 2+) --- */}
              {currentSessionNumber >= 2 && (
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <Section title="Rumusan Keseluruhan dan Langkah Kehadapan">
                    <EnhancedTextArea
                      label="Status Perniagaan Keseluruhan"
                      name="STATUS_PERNIAGAAN_KESELURUHAN"
                      value={formData.STATUS_PERNIAGAAN_KESELURUHAN || ''}
                      onChange={handleChange}
                      required={false}
                      rows={6}
                      helperText={`Panduan:
- Aktiviti pemasaran dan jualan
- Perekodan maklumat akaun, sistem yang digunakan
Apa yang usahawan mahu capai kedepan.
Pemerhatian Mentor/Coach (apa yang bagus, apa yang kurang dan boleh ditambahbaik oleh usahawan)
Kenalpasti bahagian yang boleh nampak peningkatan sebelum dan selepas setahun lalui program:
- Pendapatan
- Keuntungan
- Penambahan pekerja
- Adaptasi teknologi
- Peningkatan skil/pengetahuan`}
                    />

                    <EnhancedTextArea
                      label={`Rumusan Keseluruhan dan Langkah Kehadapan ${currentSessionNumber >= 2 ? '*' : ''}`}
                      name="RUMUSAN_DAN_LANGKAH_KEHADAPAN"
                      value={formData.RUMUSAN_DAN_LANGKAH_KEHADAPAN || ''}
                      onChange={handleChange}
                      required={currentSessionNumber >= 2}
                      rows={8}
                      helperText={`Nota:
Pastikan peserta pulang dengan Keputusan dan Tindakan yang perlu diusahakan, siapa dan bila. (Kongsikan/pastika usahawan juga jelas)
Apakah ada homework untuk peserta.
Sebaiknya, tetapkan masa pertemuan sesi akan datang, dan mod perbincangan.
Apakah bantuan, latihan yang mahu dicadangkan kepada HQ untuk membantu usahawan.
Apakah mentor ada bahan tambahan yang dapat membantu usahawan.
Apakah mentor perlukan bahan tambahan/banuan dari mentor mentor lain atau HQ.
Rumus poin-poin penting yang perlu diberi perhatian atau penekanan baik isu berkaitan bisnes mahupun tingkahlaku atau komitmen peserta.`}
                    />
                  </Section>
                </div>
              )}

              {/* ============== UPWARD MOBILITY SECTIONS (3-6) ============== */}

              {/* --- Section 3: Status & Mobiliti --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                <Section title={
                  <div className="flex items-center justify-between">
                    <span>Bahagian 3: Status & Mobiliti Usahawan</span>
                    <span className="ml-auto px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
                      UPWARD MOBILITY
                    </span>
                  </div>
                }>
                  <InfoCard message="💡 Bahagian ini untuk menilai tahap kemajuan usahawan dalam program mentoring." />

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upward Mobility Status <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-start p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                        <input
                          type="radio"
                          name="UM_STATUS"
                          value="G1"
                          checked={formData.UPWARD_MOBILITY.UM_STATUS === 'G1'}
                          onChange={(e) => handleUMChange('UM_STATUS', e.target.value)}
                          className="mr-3 mt-1"
                          required
                        />
                        <div>
                          <span className="font-bold">Grade 1 (G1)</span>
                          <span className="text-gray-600"> - Lulus kemudahan/fasiliti SME</span>
                        </div>
                      </label>
                      <label className="flex items-start p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                        <input
                          type="radio"
                          name="UM_STATUS"
                          value="G2"
                          checked={formData.UPWARD_MOBILITY.UM_STATUS === 'G2'}
                          onChange={(e) => handleUMChange('UM_STATUS', e.target.value)}
                          className="mr-3 mt-1"
                        />
                        <div>
                          <span className="font-bold">Grade 2 (G2)</span>
                          <span className="text-gray-600"> - Berjaya improve credit worthiness</span>
                        </div>
                      </label>
                      <label className="flex items-start p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                        <input
                          type="radio"
                          name="UM_STATUS"
                          value="G3"
                          checked={formData.UPWARD_MOBILITY.UM_STATUS === 'G3'}
                          onChange={(e) => handleUMChange('UM_STATUS', e.target.value)}
                          className="mr-3 mt-1"
                        />
                        <div>
                          <span className="font-bold">Grade 3 (G3)</span>
                          <span className="text-gray-600"> - Improve mana-mana bahagian bisnes</span>
                        </div>
                      </label>
                      <label className="flex items-start p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                        <input
                          type="radio"
                          name="UM_STATUS"
                          value="NIL"
                          checked={formData.UPWARD_MOBILITY.UM_STATUS === 'NIL'}
                          onChange={(e) => handleUMChange('UM_STATUS', e.target.value)}
                          className="mr-3 mt-1"
                        />
                        <div>
                          <span className="font-bold">NIL</span>
                          <span className="text-gray-600"> - Tiada peningkatan</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Quick Tags Section */}
                  {formData.UPWARD_MOBILITY.UM_STATUS && formData.UPWARD_MOBILITY.UM_STATUS !== 'NIL' && GRADE_CRITERIA_MAP[formData.UPWARD_MOBILITY.UM_STATUS] && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        💡 Quick Tags - Klik untuk tambah ke kriteria:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {GRADE_CRITERIA_MAP[formData.UPWARD_MOBILITY.UM_STATUS].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleTagClick(tag)}
                            className="px-3 py-1.5 bg-white border-2 border-blue-400 text-blue-700 rounded-full hover:bg-blue-500 hover:text-white hover:border-blue-600 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Klik mana-mana tag di atas untuk menambahnya ke dalam textarea di bawah. Anda masih boleh taip sendiri jika perlu.
                      </p>
                    </div>
                  )}

                  <TextArea
                    label="Jika G1/G2/G3, nyatakan kriteria improvement"
                    name="UM_KRITERIA_IMPROVEMENT"
                    value={formData.UPWARD_MOBILITY.UM_KRITERIA_IMPROVEMENT}
                    onChange={(e) => handleUMChange('UM_KRITERIA_IMPROVEMENT', e.target.value)}
                    rows={3}
                    placeholder="Contoh: Grade 2 - Berjaya bayar balik pinjaman tepat pada masa, credit score meningkat dari C kepada B"
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Tarikh Lawatan ke Premis
                    </label>
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_TARIKH_LAWATAN_STATUS"
                          value="sudah"
                          checked={formData.UPWARD_MOBILITY.UM_TARIKH_LAWATAN_PREMIS !== 'Belum dilawat'}
                          onChange={(e) => {
                            if (e.target.checked && formData.UPWARD_MOBILITY.UM_TARIKH_LAWATAN_PREMIS === 'Belum dilawat') {
                              handleUMChange('UM_TARIKH_LAWATAN_PREMIS', '');
                            }
                          }}
                          className="mr-2"
                        />
                        <span>Sudah dilawat</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_TARIKH_LAWATAN_STATUS"
                          value="belum"
                          checked={formData.UPWARD_MOBILITY.UM_TARIKH_LAWATAN_PREMIS === 'Belum dilawat'}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleUMChange('UM_TARIKH_LAWATAN_PREMIS', 'Belum dilawat');
                            }
                          }}
                          className="mr-2"
                        />
                        <span>Belum dilawat</span>
                      </label>
                    </div>
                    {formData.UPWARD_MOBILITY.UM_TARIKH_LAWATAN_PREMIS !== 'Belum dilawat' && (
                      <input
                        type="date"
                        name="UM_TARIKH_LAWATAN_PREMIS"
                        value={formData.UPWARD_MOBILITY.UM_TARIKH_LAWATAN_PREMIS}
                        onChange={(e) => handleUMChange('UM_TARIKH_LAWATAN_PREMIS', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </Section>
              </div>

              {/* --- Section 4: Bank Islam & Fintech --- */}
              {/* --- Section 4: Bank Islam & Fintech --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                <Section title={
                  <div className="flex items-center justify-between">
                    <span>{UPWARD_MOBILITY_SECTIONS.SECTION_4.title}</span>
                    <span className="ml-auto px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
                      UPWARD MOBILITY
                    </span>
                  </div>
                }>
                  <div className="space-y-4">
                    {UPWARD_MOBILITY_SECTIONS.SECTION_4.items.map((item) => (
                      <div key={item.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="font-semibold text-gray-700 mb-2">{item.title}</div>
                        <div className="text-sm text-gray-600 mb-3">
                          {item.desc.split('\n').map((line, i) => (
                            <p key={i} className="mb-1">
                              {line.includes('Klik Yes') || line.includes('Klik No') ? (
                                <><strong>{line.split('-')[0]}</strong> -{line.split('-').slice(1).join('-')}</>
                              ) : line}
                            </p>
                          ))}
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              value="Ya"
                              checked={formData.UPWARD_MOBILITY[item.id] === 'Ya'}
                              onChange={(e) => handleUMChange(item.id, e.target.value)}
                              className="mr-2"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              value="Tidak"
                              checked={formData.UPWARD_MOBILITY[item.id] === 'Tidak'}
                              onChange={(e) => handleUMChange(item.id, e.target.value)}
                              className="mr-2"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              {/* --- Section 5: Situasi Kewangan Perniagaan (Semasa) --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                <Section title={
                  <div className="flex items-center justify-between">
                    <span>{UPWARD_MOBILITY_SECTIONS.SECTION_5.title}</span>
                    <span className="ml-auto px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
                      UPWARD MOBILITY
                    </span>
                  </div>
                }>
                  <InfoCard>
                    {UPWARD_MOBILITY_SECTIONS.SECTION_5.infoMessage}
                  </InfoCard>

                  <div className="space-y-6">
                    {UPWARD_MOBILITY_SECTIONS.SECTION_5.items.map((item) => (
                      <div key={item.field} className="border-l-4 border-orange-300 pl-4">
                        {item.type === 'radio_yes_no' ? (
                          <div className="mb-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {item.label} <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-4">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  value="Ya"
                                  checked={formData.UPWARD_MOBILITY[item.field] === 'Ya'}
                                  onChange={(e) => handleUMChange(item.field, e.target.value)}
                                  className="mr-2"
                                />
                                <span>Ya</span>
                              </label>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  value="Tidak"
                                  checked={formData.UPWARD_MOBILITY[item.field] === 'Tidak'}
                                  onChange={(e) => handleUMChange(item.field, e.target.value)}
                                  className="mr-2"
                                />
                                <span>Tidak</span>
                              </label>
                            </div>
                          </div>
                        ) : (
                          <InputField
                            label={item.label + ' *'}
                            type="number"
                            value={formData.UPWARD_MOBILITY[item.field]}
                            onChange={(e) => handleUMChange(item.field, e.target.value)}
                            placeholder={item.placeholder}
                            step="0.01"
                            required
                          />
                        )}
                        <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                          <TextArea
                            label={item.ulasanLabel}
                            value={formData.UPWARD_MOBILITY[item.ulasanField]}
                            onChange={(e) => handleUMChange(item.ulasanField, e.target.value)}
                            rows={2}
                            placeholder={item.ulasanPlaceholder}
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              {/* --- Section 6: Digitalisasi & Pemasaran Online (Semasa) --- */}
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                <Section title={
                  <div className="flex items-center justify-between">
                    <span>{UPWARD_MOBILITY_SECTIONS.SECTION_6.title}</span>
                    <span className="ml-auto px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
                      UPWARD MOBILITY
                    </span>
                  </div>
                }>
                  <div className="space-y-6">
                    {/* Digital */}
                    <div className="border-l-4 border-orange-300 pl-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        {UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.label} <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.options.map((opt) => (
                          <label key={opt} className="flex items-center p-2 hover:bg-orange-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              value={opt}
                              checked={(formData.UPWARD_MOBILITY[UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.field] || []).includes(opt)}
                              onChange={(e) => handleUMCheckboxChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.field, opt, e.target.checked)}
                              className="mr-3"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <TextArea
                          label={UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanLabel}
                          value={formData.UPWARD_MOBILITY[UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanField]}
                          onChange={(e) => handleUMChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanField, e.target.value)}
                          rows={2}
                          placeholder={UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanPlaceholder}
                          required
                        />
                      </div>
                    </div>

                    {/* Marketing */}
                    <div className="border-l-4 border-orange-300 pl-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        {UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.label} <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.options.map((opt) => (
                          <label key={opt} className="flex items-center p-2 hover:bg-orange-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              value={opt}
                              checked={(formData.UPWARD_MOBILITY[UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.field] || []).includes(opt)}
                              onChange={(e) => handleUMCheckboxChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.field, opt, e.target.checked)}
                              className="mr-3"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <TextArea
                          label={UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanLabel}
                          value={formData.UPWARD_MOBILITY[UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanField]}
                          onChange={(e) => handleUMChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanField, e.target.value)}
                          rows={2}
                          placeholder={UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanPlaceholder}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </Section>
              </div>



              <div className="bg-white p-6 rounded-lg shadow-sm">
                <Section title="Lampiran Gambar">
                  {currentSessionNumber === 1 && (
                    <FileInput
                      label="Gambar GW360 (Sesi 1 Sahaja)"
                      name="URL_GAMBAR_GW360"
                      onFileChange={(e) => handleFileChange('gw360', e.target.files)}
                      multiple={false}
                      required={currentSessionNumber === 1}
                      isImageUpload={true}
                    />
                  )}
                  {formData.URL_GAMBAR_GW360 && currentSessionNumber === 1 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">
                        Uploaded GW360:{' '}
                        <a
                          href={formData.URL_GAMBAR_GW360}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          View Image
                        </a>
                      </p>
                    </div>
                  )}

                  <FileInput
                    label="Gambar Sesi (Pelbagai Gambar)"
                    name="URL_GAMBAR_SESI_JSON"
                    onFileChange={(e) => handleFileChange('sesi', e.target.files, true)}
                    multiple={true}
                    required
                    isImageUpload={true}
                  />
                  {formData.URL_GAMBAR_SESI_JSON.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">Uploaded Sesi Images:</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.URL_GAMBAR_SESI_JSON.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-sm"
                          >
                            Image {index + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasPremisPhotosUploaded ? (
                    <div>
                      <label className="flex items-center mt-4">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={lawatanPremisChecked}
                          onChange={() => setLawatanPremisChecked(!lawatanPremisChecked)}
                        />
                        <span className="ml-2 text-gray-700">Lawatan Premis Telah Dijalankan?</span>
                      </label>
                      {lawatanPremisChecked && (
                        <div>
                          <FileInput
                            label="Gambar Lawatan Premis *"
                            name="URL_GAMBAR_PREMIS_JSON"
                            onFileChange={(e) => handleFileChange('premis', e.target.files, true)}
                            multiple={true}
                            required={lawatanPremisChecked}
                            isImageUpload={true}
                          />
                          <p className="mt-1 text-sm text-gray-600 italic">
                            Gambar bahagian depan premis bisnes mentee, Gambar-gambar ruang dalam bisnes mentee, Gambar-gambar aset yang ada (terutama yang dibeli menggunakan geran BIMB), selfie depan premise
                          </p>
                        </div>
                      )}
                      {formData.URL_GAMBAR_PREMIS_JSON.length > 0 && lawatanPremisChecked && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">Uploaded Premis Images:</p>
                          <div className="flex flex-wrap gap-2">
                            {formData.URL_GAMBAR_PREMIS_JSON.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline text-sm"
                              >
                                Image {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <InfoCard title="Lawatan Premis Status" type="info">
                      Lawatan Premis telah direkodkan.
                    </InfoCard>
                  )}
                </Section>
              </div>

              {/* --- Bahagian Upward Mobility --- */}
              {(currentSessionNumber === 2 || currentSessionNumber === 4) && (
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <Section title="Bahagian Upward Mobility">
                    <InfoCard title="Peringatan Penting" type="info">
                      <p>[SESI 2 & 4 SAHAJA] Sila lengkapkan borang Forms Upward Mobility di pautan berikut:</p>
                      <a
                        href="/upward-mobility"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Link to Upward Mobility Google Form
                      </a>
                    </InfoCard>
                  </Section>
                </div>
              )}
            </>
          )
          }

          {/* Submit area: white card with centered buttons */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            {/* Compression Progress Indicator */}
            {compressionProgress.show && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      📸 Compressing: {compressionProgress.fileName}
                    </p>
                    <p className="text-xs text-blue-700">
                      Step {compressionProgress.current}/{compressionProgress.total}: {compressionProgress.message}
                    </p>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(compressionProgress.current / compressionProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submission Stage Progress Indicator */}
            {submissionStage.stage && submissionStage.stage !== 'complete' && !compressionProgress.show && (
              <div className={`border rounded-lg p-4 mb-4 ${submissionStage.stage === 'error'
                ? 'bg-red-50 border-red-200'
                : submissionStage.stage === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
                }`}>
                <div className="flex items-center space-x-3">
                  {submissionStage.stage !== 'error' && submissionStage.stage !== 'warning' && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  )}
                  {submissionStage.stage === 'error' && (
                    <div className="text-red-600 text-2xl">⚠️</div>
                  )}
                  {submissionStage.stage === 'warning' && (
                    <div className="text-yellow-600 text-2xl">⚠️</div>
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${submissionStage.stage === 'error'
                      ? 'text-red-900'
                      : submissionStage.stage === 'warning'
                        ? 'text-yellow-900'
                        : 'text-blue-900'
                      }`}>
                      {submissionStage.message}
                    </p>
                    {submissionStage.detail && (
                      <p className={`text-xs mt-1 ${submissionStage.stage === 'error'
                        ? 'text-red-700'
                        : submissionStage.stage === 'warning'
                          ? 'text-yellow-700'
                          : 'text-blue-700'
                        }`}>
                        {submissionStage.detail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                disabled={loading || compressionProgress.show}
              >
                Reset Form
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                disabled={loading || compressionProgress.show}
              >
                {compressionProgress.show ? '🔄 Compressing Images...' : loading ? '📤 Submitting...' : 'Submit Laporan Maju'}
              </button>
            </div>
            {saveStatus && (
              <div className="mt-2 text-xs text-gray-500 text-center">
                {saveStatus}
              </div>
            )}
          </div>
        </form >
      </div >

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSubmissionResult(null);
        }}
        submissionId={submissionResult?.submissionId}
        submittedAt={submissionResult?.submittedAt}
        menteeName={submissionResult?.menteeName}
        sessionNumber={submissionResult?.sessionNumber}
        program={submissionResult?.program}
      />
    </div >
  );
};

export default LaporanMajuPage;
