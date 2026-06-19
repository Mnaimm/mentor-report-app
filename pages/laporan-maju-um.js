// pages/laporan-maju.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
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
  INITIAL_UPWARD_MOBILITY_STATE,
  validateUpwardMobility,
} from '../lib/upwardMobilityUtils';
import UMSection from '../components/UMSection';
import {
  MIA_PROOF_TYPES,
  validateMIAProofs,
  validateMIAReason,
  prepareMIARequestPayload,
  getMIACheckboxClasses
} from '../lib/mia';

// Helper function to get today's date in yyyy-MM-dd format (safe for SSR)
const getTodayDate = () => {
  if (typeof window === 'undefined') {
    // Server-side: return empty string or a default
    return '';
  }
  // Client-side: return today's date in YYYY-MM-DD format
  const today = new Date();
  return today.toISOString().split('T')[0];
};

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
  const router = useRouter();
  const isAdmin = session?.user?.email && process.env.NEXT_PUBLIC_ADMIN_EMAILS?.includes(session.user.email);

  // Redirect is_khas mentors (non-coordinators) to laporan-khas
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/khas/check-mentor')
      .then(r => r.json())
      .then(d => { if (d.isKhas && !d.isCoordinator) router.replace('/laporan-khas'); })
      .catch(() => {});
  }, [status]);

  // REVISION MODE STATE
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [existingReportId, setExistingReportId] = useState(null);
  const [revisionData, setRevisionData] = useState(null);

  const initialFormState = {
    // These match your LaporanMaju sheet headers for direct submission
    Timestamp: '',
    NAMA_MENTOR: '',
    EMAIL_MENTOR: '',
    NAMA_MENTEE: '',
    entrepreneur_id: null, // Entrepreneur UUID from mapping for Supabase lookup
    NAMA_BISNES: '',
    LOKASI_BISNES: '',
    PRODUK_SERVIS: '',
    NO_TELEFON: '',
    emel: '', // Mentee email from mapping for Supabase entrepreneur lookup
    BATCH: '',
    TARIKH_SESI: '', // Will be set on component mount
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
    // KEMASKINI MAKLUMAT (Updated Contact Info)
    KEMASKINI_MAKLUMAT: {
      telefon_baharu: '',
      alamat_baharu: ''
    },
  };

  const [formData, setFormData] = useState(initialFormState);
  const [allMenteesMapping, setAllMenteesMapping] = useState([]);
  const [mentorsInMapping, setMentorsInMapping] = useState([]);
  const [filteredMenteesForDropdown, setFilteredMenteesForDropdown] = useState([]);
  const [selectedMentorEmail, setSelectedMentorEmail] = useState(session?.user?.email || '');
  const [currentSessionNumber, setCurrentSessionNumber] = useState(1);
  const [previousMentoringFindings, setPreviousMentoringFindings] = useState([]);
  const [hasPremisPhotosUploaded, setHasPremisPhotosUploaded] = useState(false);
  const [lawatanPremisChecked, setLawatanPremisChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isMIA, setIsMIA] = useState(false);
  const [miaReason, setMiaReason] = useState('');
  const [maklumatBerubah, setMaklumatBerubah] = useState(false);
  const [files, setFiles] = useState({
    gw360: null,
    sesi: [],
    premis: [],
    mia: {
      whatsapp: null,
      email: null,
      call: null
    }
  });
  const [compressionProgress, setCompressionProgress] = useState({ show: false, current: 0, total: 0, message: '', fileName: '' });
  const [submissionStage, setSubmissionStage] = useState({ stage: '', message: '', detail: '' });

  // Receipt Modal State
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [prefillBatchRoundId, setPrefillBatchRoundId] = useState(null);
  const urlPrefillApplied = useRef(false);

  // UM carry-forward state
  const [praisiDari, setPraisiDari] = useState(null);
  const [lockedSections, setLockedSections] = useState({ bank: false, aset: false, digital: false });

  // --- Draft/Autosave functionality ---
  const getDraftKey = (menteeName, sessionNo, mentorEmail) =>
    `laporanMaju:draft:v1:${mentorEmail || 'unknown'}:${menteeName || 'none'}:s${sessionNo}`;
  const [saveStatus, setSaveStatus] = useState('');
  const [autosaveArmed, setAutosaveArmed] = useState(false);

  // Set TARIKH_SESI on client-side mount
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      TARIKH_SESI: getTodayDate()
    }));
  }, []);

  // Effect to fetch mapping data on component mount
  useEffect(() => {
    const fetchMappingData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/mapping?programType=maju');
        if (!response.ok) {
          throw new Error('Masalah sambungan. Sila semak internet dan cuba lagi.');
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
        setMessage('Gagal memuatkan data mentee. Sila refresh halaman.');
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

  // --- REVISION MODE DETECTION AND REPORT FETCHING ---
  useEffect(() => {
    const detectRevisionMode = async () => {
      if (router.query.mode === 'revision' && router.query.reportId && status === 'authenticated') {
        const reportId = router.query.reportId;

        console.log('🔄 Revision mode detected for Maju report:', reportId);

        try {
          const response = await fetch(`/api/reports/${reportId}`);

          if (!response.ok) {
            throw new Error('Masalah sambungan. Sila semak internet dan cuba lagi.');
          }

          const report = await response.json();

          // Security check
          if (report.mentor_email !== session.user.email) {
            setMessage('Akses ditolak - Anda hanya boleh kemaskini laporan anda sendiri.');
            setMessageType('error');
            return;
          }

          // Verify status
          if (report.status !== 'review_requested') {
            setMessage('Laporan ini tidak boleh dikemaskini pada masa ini. Sila hubungi admin.');
            setMessageType('error');
            return;
          }

          setIsRevisionMode(true);
          setExistingReportId(reportId);
          setRevisionData(report);

          console.log('✅ Revision mode activated for Maju report:', reportId);

        } catch (err) {
          console.error('❌ Error fetching report for revision:', err);
          setMessage('Gagal memuatkan laporan. Sila cuba lagi atau hubungi admin.');
          setMessageType('error');
        }
      }
    };

    detectRevisionMode();
  }, [router.query.mode, router.query.reportId, status, session?.user?.email]);

  // --- PRE-FILL FORM FROM REVISION DATA ---
  useEffect(() => {
    if (!revisionData || !isRevisionMode) return;

    console.log('📝 Pre-filling Maju form with revision data...');

    try {
      // Find the mentee in the mapping data
      const mentee = allMenteesMapping.find(m =>
        m.Usahawan === revisionData.nama_mentee ||
        m.No_IC === revisionData.mentee_ic
      );

      // Set session number (LOCKED in revision mode)
      setCurrentSessionNumber(revisionData.session_number);

      // Set MIA status
      setIsMIA(revisionData.mia_status === 'MIA');
      if (revisionData.mia_status === 'MIA') {
        setMiaReason(revisionData.mia_reason || '');
      }

      // Pre-fill form data
      const preFillData = {
        Timestamp: revisionData.submission_date || '',
        NAMA_MENTOR: revisionData.nama_mentor || '',
        EMAIL_MENTOR: revisionData.mentor_email || '',
        NAMA_MENTEE: revisionData.nama_mentee || '',
        NAMA_BISNES: revisionData.nama_bisnes || '',
        LOKASI_BISNES: revisionData.lokasi_bisnes || '',
        PRODUK_SERVIS: revisionData.produk_servis || '',
        NO_TELEFON: revisionData.no_telefon || '',
        emel: mentee?.Emel || '',
        BATCH: revisionData.batch || '',
        TARIKH_SESI: revisionData.session_date || getTodayDate(),
        SESI_NUMBER: revisionData.session_number,
        MOD_SESI: revisionData.mod_sesi || '',
        LOKASI_F2F: revisionData.lokasi_f2f || '',
        MASA_MULA: revisionData.masa_mula || '',
        MASA_TAMAT: revisionData.masa_tamat || '',
        LATARBELAKANG_USAHAWAN: revisionData.latarbelakang_usahawan || '',
        DATA_KEWANGAN_BULANAN_JSON: revisionData.data_kewangan_bulanan || [],
        MENTORING_FINDINGS_JSON: revisionData.mentoring_findings || [],
        URL_GAMBAR_PREMIS_JSON: revisionData.image_urls?.premis || [],
        URL_GAMBAR_SESI_JSON: revisionData.image_urls?.sesi || [],
        URL_GAMBAR_GW360: revisionData.image_urls?.growthwheel || '',
        Folder_ID: revisionData.folder_id || '',
        Laporan_Maju_Doc_ID: revisionData.doc_url || '',
        STATUS_PERNIAGAAN_KESELURUHAN: revisionData.status_perniagaan || '',
        RUMUSAN_DAN_LANGKAH_KEHADAPAN: revisionData.rumusan_langkah_kehadapan || '',
        MIA_PROOF_URL: revisionData.mia_proof_url || '',
        UPWARD_MOBILITY: revisionData.upward_mobility_data || { ...INITIAL_UPWARD_MOBILITY_STATE }
      };

      setFormData(preFillData);

      // Set previous data if needed for Sesi 2+
      if (revisionData.session_number > 1) {
        setPreviousMentoringFindings(revisionData.mentoring_findings || []);
      }

      console.log('✅ Maju form pre-filled successfully');

    } catch (err) {
      console.error('❌ Error pre-filling Maju form:', err);
      setMessage('Gagal memuatkan laporan. Sila cuba lagi atau hubungi admin.');
      setMessageType('error');
    }
  }, [revisionData, isRevisionMode, allMenteesMapping]);

  // --- URL QUERY PARAM PREFILL ---
  useEffect(() => {
    if (urlPrefillApplied.current) return;
    if (!router.isReady) return;
    if (router.query.mode === 'revision') return;
    const { mentor_id, entrepreneur_id, batch_round_id } = router.query;
    if (!mentor_id && !entrepreneur_id && !batch_round_id) return;
    if (allMenteesMapping.length === 0) return; // wait for mentorList (allMenteesMapping) to populate
    if (status !== 'authenticated') return;

    urlPrefillApplied.current = true;

    if (batch_round_id) setPrefillBatchRoundId(batch_round_id);

    let mentorEmailSelected = null;

    // mentor_id: match against Mentor_Email in mapping data (admin-only dropdown)
    if (isAdmin && mentor_id) {
      const mentorEntry = allMenteesMapping.find(m => m.Mentor_Email === mentor_id);
      if (mentorEntry) {
        mentorEmailSelected = mentorEntry.Mentor_Email;
        setSelectedMentorEmail(mentorEntry.Mentor_Email);
        const mentorMentees = allMenteesMapping.filter(m => m.Mentor_Email === mentorEntry.Mentor_Email);
        setFilteredMenteesForDropdown(mentorMentees);

        if (entrepreneur_id) {
          const menteeRecord = mentorMentees.find(m => m.entrepreneur_id === entrepreneur_id);
          if (menteeRecord) {
            // handleMenteeSelect has stale filteredMenteesForDropdown closure; fix entrepreneur_id after
            handleMenteeSelect({ target: { value: menteeRecord.Usahawan } });
            setFormData(prev => ({ ...prev, entrepreneur_id: menteeRecord.entrepreneur_id || null }));
          }
        }
        return;
      }
      // mentor_id not found in mapping (e.g. raw UUID) → ignored silently, fall through
    }

    // entrepreneur_id: derive mentor from mapping entry when mentor not already selected
    if (entrepreneur_id) {
      const mappingEntry = allMenteesMapping.find(m => m.entrepreneur_id === entrepreneur_id);
      if (!mappingEntry) return; // invalid entrepreneur_id → ignore silently

      if (isAdmin && !mentorEmailSelected) {
        setSelectedMentorEmail(mappingEntry.Mentor_Email);
        const mentorMentees = allMenteesMapping.filter(m => m.Mentor_Email === mappingEntry.Mentor_Email);
        setFilteredMenteesForDropdown(mentorMentees);
      }

      // handleMenteeSelect has stale filteredMenteesForDropdown closure; fix entrepreneur_id after
      handleMenteeSelect({ target: { value: mappingEntry.Usahawan } });
      setFormData(prev => ({ ...prev, entrepreneur_id: mappingEntry.entrepreneur_id || null }));
    }
  }, [router.query, allMenteesMapping]);

  // Handle Mentee Selection & Load Session Data
  const handleMenteeSelect = useCallback(async (e) => {
    const selectedMenteeName = e.target.value;

    // Look up in full mapping list — filteredMenteesForDropdown has a stale closure issue
    // (same pattern as laporan-bangkit.js which uses allMentees.find)
    const selectedMenteeData = allMenteesMapping.find(m => m.Usahawan === selectedMenteeName);

    setFormData(prev => ({
      ...prev,
      NAMA_MENTEE: selectedMenteeName,
      entrepreneur_id: selectedMenteeData?.entrepreneur_id || null,
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
    setHasPremisPhotosUploaded(false);
    setLawatanPremisChecked(false);
    setIsMIA(false);
    setMiaReason('');
    setFiles(prev => ({
      ...prev,
      mia: { whatsapp: null, email: null, call: null }
    }));
    setPraisiDari(null);
    setLockedSections({ bank: false, aset: false, digital: false });

    if (!selectedMenteeName) {
      setMessage('');
      setMessageType('');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const entrepreneurId = selectedMenteeData?.entrepreneur_id;
      const [response, umPrefillRes, latarBelakangRes, latestUMRes] = await Promise.all([
        fetch(`/api/laporanMajuData?name=${encodeURIComponent(selectedMenteeName)}`),
        entrepreneurId
          ? fetch(`/api/mentee-um-prefill?entrepreneur_id=${encodeURIComponent(entrepreneurId)}`)
          : Promise.resolve(null),
        entrepreneurId
          ? fetch(`/api/prefill/maju-latarbelakang?entrepreneur_id=${encodeURIComponent(entrepreneurId)}`)
          : Promise.resolve(null),
        entrepreneurId
          ? fetch(`/api/um/latest-report?entrepreneurId=${encodeURIComponent(entrepreneurId)}`)
          : Promise.resolve(null),
      ]);
      if (!response.ok) {
        throw new Error('Masalah sambungan. Sila semak internet dan cuba lagi.');
      }
      const sessionData = await response.json();
      const umPrefill = umPrefillRes?.ok ? await umPrefillRes.json() : {};
      const latarBelakangPrefill = latarBelakangRes?.ok ? await latarBelakangRes.json() : {};
      const latestUMResult = latestUMRes?.ok ? await latestUMRes.json() : {};
      const prevUM = latestUMResult?.data || null;
      if (prevUM) {
        setPraisiDari(prevUM.sesi_mentoring || 'Sesi Sebelumnya');
      }

      setFormData(prev => {
        const updatedFormData = { ...prev };

        if (sessionData.menteeMapping) {
          updatedFormData.NAMA_BISNES = sessionData.menteeMapping.NAMA_BISNES || '';
          updatedFormData.LOKASI_BISNES = sessionData.menteeMapping.LOKASI_BISNES || '';
          updatedFormData.PRODUK_SERVIS = sessionData.menteeMapping.PRODUK_SERVIS || '';
          updatedFormData.NO_TELEFON = sessionData.menteeMapping.NO_TELEFON || '';
          // Use the correct field name from the mapping sheet
          updatedFormData.Folder_ID = sessionData.menteeMapping.Folder_ID || '';
          // Store mentee email for Supabase entrepreneur lookup
          updatedFormData.emel = sessionData.menteeMapping.MENTEE_EMAIL_FROM_MAPPING || '';
          updatedFormData.BATCH = sessionData.menteeMapping.BATCH || ''; // Set Batch from mapping

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

        updatedFormData.LATARBELAKANG_USAHAWAN = latarBelakangPrefill?.latarbelakang_usahawan || '';

        setHasPremisPhotosUploaded(sessionData.hasPremisPhotos || false);

        if (prevUM) {
          const parseUMArray = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            return typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
          };
          // Fix 2: normalize DB values to match radio option casing ('Ya'/'Tidak')
          const normalizeYaTidak = (val) => {
            if (val == null) return val;
            const lower = String(val).toLowerCase();
            if (lower === 'ya' || lower === 'yes') return 'Ya';
            if (lower === 'tidak' || lower === 'no') return 'Tidak';
            return val;
          };
          updatedFormData.UPWARD_MOBILITY = {
            ...updatedFormData.UPWARD_MOBILITY,
            // Bahagian 4: Bank Islam
            ...(prevUM.bank_akaun_semasa != null && { UM_AKAUN_BIMB: normalizeYaTidak(prevUM.bank_akaun_semasa) }),
            ...(prevUM.bank_bizapp != null && { UM_BIMB_BIZ: normalizeYaTidak(prevUM.bank_bizapp) }),
            ...(prevUM.bank_al_awfar != null && { UM_AL_AWFAR: normalizeYaTidak(prevUM.bank_al_awfar) }),
            ...(prevUM.bank_merchant_terminal != null && { UM_MERCHANT_TERMINAL: normalizeYaTidak(prevUM.bank_merchant_terminal) }),
            ...(prevUM.bank_fasiliti_lain != null && { UM_FASILITI_LAIN: normalizeYaTidak(prevUM.bank_fasiliti_lain) }),
            ...(prevUM.bank_mesinkira != null && { UM_MESINKIRA: normalizeYaTidak(prevUM.bank_mesinkira) }),
            // Bahagian 5: pendapatan/pekerja (editable, no lock)
            UM_PEKERJA_SEMASA: prevUM.pekerja_semasa != null ? String(prevUM.pekerja_semasa) : '',
            UM_ULASAN_PEKERJA: prevUM.ulasan_pekerja ?? '',
            UM_PEKERJA_PARTTIME_SEMASA: prevUM.pekerja_parttime_semasa != null ? String(prevUM.pekerja_parttime_semasa) : '',
            UM_ULASAN_PEKERJA_PARTTIME: prevUM.ulasan_pekerja_parttime ?? '',
            // Bahagian 5: aset bukan tunai + simpanan + zakat (lockable group)
            UM_ASET_BUKAN_TUNAI_SEMASA: prevUM.aset_bukan_tunai_semasa != null ? String(prevUM.aset_bukan_tunai_semasa) : '',
            UM_ULASAN_ASET_BUKAN_TUNAI: prevUM.ulasan_aset_bukan_tunai ?? '',
            UM_SIMPANAN_SEMASA: prevUM.simpanan_semasa != null ? String(prevUM.simpanan_semasa) : '',
            UM_ULASAN_SIMPANAN: prevUM.ulasan_simpanan ?? '',
            UM_ZAKAT_SEMASA: prevUM.zakat_semasa != null ? String(prevUM.zakat_semasa) : '',
            UM_ULASAN_ZAKAT: prevUM.ulasan_zakat ?? '',
            // Bahagian 6: digital + marketing (Fix 4 — ulasan fields always set)
            ...(parseUMArray(prevUM.digital_semasa).length > 0 && { UM_DIGITAL_SEMASA: parseUMArray(prevUM.digital_semasa) }),
            UM_ULASAN_DIGITAL: prevUM.ulasan_digital ?? '',
            ...(parseUMArray(prevUM.marketing_semasa).length > 0 && { UM_MARKETING_SEMASA: parseUMArray(prevUM.marketing_semasa) }),
            UM_ULASAN_MARKETING: prevUM.ulasan_marketing ?? '',
            // Bahagian 3: Tarikh Lawatan — carry forward only if a valid YYYY-MM-DD date
            ...(prevUM.tarikh_lawatan && /^\d{4}-\d{2}-\d{2}$/.test(prevUM.tarikh_lawatan) && {
              UM_TARIKH_LAWATAN_PREMIS: prevUM.tarikh_lawatan,
            }),
          };
        }

        // Fallback: apply tarikh_lawatan from dedicated prefill API if still empty
        // (mentee-um-prefill searches across all sessions, not just the latest)
        const prefillTarikh = umPrefill?.UM_TARIKH_LAWATAN_PREMIS;
        if (prefillTarikh && /^\d{4}-\d{2}-\d{2}$/.test(prefillTarikh) && !updatedFormData.UPWARD_MOBILITY.UM_TARIKH_LAWATAN_PREMIS) {
          updatedFormData.UPWARD_MOBILITY = {
            ...updatedFormData.UPWARD_MOBILITY,
            UM_TARIKH_LAWATAN_PREMIS: prefillTarikh,
          };
        }

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

          const draftUMKeys = Object.keys(parsed.UPWARD_MOBILITY || {});
          const validKeys = Object.keys(INITIAL_UPWARD_MOBILITY_STATE);
          const isValidShape = draftUMKeys.every(k => validKeys.includes(k));

          setFormData(prev => {
            const preservedFields = {
              NAMA_BISNES: prev.NAMA_BISNES,
              LOKASI_BISNES: prev.LOKASI_BISNES,
              PRODUK_SERVIS: prev.PRODUK_SERVIS,
              NO_TELEFON: prev.NO_TELEFON,
              Folder_ID: prev.Folder_ID,
              emel: prev.emel,
              NAMA_MENTEE: prev.NAMA_MENTEE,
              UPWARD_MOBILITY: prev.UPWARD_MOBILITY,
            };

            return {
              ...prev,
              ...parsed,
              ...preservedFields,
            };
          });
          setSaveStatus('Draft restored');
          console.log('📄 Draft restored for:', selectedMenteeName, 'Sesi', sessionData.currentSession);
        }
      } catch (draftError) {
        console.error('Failed to restore draft:', draftError);
      }

      // Enable autosave after data is loaded
      setAutosaveArmed(true);

    } catch (error) {
      console.error('Error fetching mentee session data:', error);
      setMessage('Gagal memuatkan data sesi. Sila refresh halaman atau hubungi admin.');
      setMessageType('error');
      setFormData(prev => ({
        ...initialFormState,
        NAMA_MENTOR: prev.NAMA_MENTOR,
        EMAIL_MENTOR: prev.EMAIL_MENTOR,
        TARIKH_SESI: getTodayDate(),
        NAMA_MENTEE: selectedMenteeName,
      }));
      setCurrentSessionNumber(1);
      setPreviousMentoringFindings([]);
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

  const handleLockSection = (key, val) =>
    setLockedSections((prev) => ({ ...prev, [key]: val }));

  // HOTFIX: Use working Bangkit Apps Script for images until Maju Apps Script gets uploadImage handler
  // Simple file storage functions (like laporan-sesi)
  const handleFileChange = (type, fileList, multiple = false) => {
    setFiles((prev) => ({
      ...prev,
      [type]: multiple ? Array.from(fileList) : fileList[0]
    }));
  };

  const handleMIAFileChange = (proofType, fileList) => {
    const file = fileList?.[0] || null;

    // Clone File object to prevent it from becoming invalid when DOM re-renders
    const clonedFile = file ? new File([file], file.name, { type: file.type }) : null;

    setFiles((prev) => ({
      ...prev,
      mia: {
        ...prev.mia,
        [proofType]: clonedFile
      }
    }));
    console.log('Updated MIA proofs:', proofType, clonedFile);
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
      setMessage('Gagal memuat naik gambar. Sila semak sambungan internet dan cuba lagi. Jika masalah berterusan, hubungi admin.');
      setMessageType('error');
      setLoading(false);
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
      setMessage('Gagal memuat naik gambar. Sila semak sambungan internet dan cuba lagi. Jika masalah berterusan, hubungi admin.');
      setMessageType('error');
      setLoading(false);
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
      TARIKH_SESI: getTodayDate(),
    });
    setCurrentSessionNumber(1);
    setPreviousMentoringFindings([]);
    setHasPremisPhotosUploaded(false);
    setLawatanPremisChecked(false);
    setMessage('');
    setMessageType('');
    setLoading(false);
    setIsMIA(false);
    setMiaReason('');
    setFiles({
      gw360: null,
      sesi: [],
      premis: [],
      mia: { whatsapp: null, email: null, call: null }
    });
    setSaveStatus('');
    setAutosaveArmed(false);
    setPraisiDari(null);
    setLockedSections({ bank: false, aset: false, digital: false });

    // Clear all file inputs in the DOM
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.value = '';
    });

    // Clear any "Uploaded" status messages by resetting the page display
    console.log('✅ Form reset complete - all fields and file inputs cleared');
  };

  // --- REVISION MODE: Check if a field category needs highlighting ---
  const shouldHighlightField = (category) => {
    if (!isRevisionMode || !revisionData?.revision_reason) return false;
    return revisionData.revision_reason.includes(category);
  };

  // --- REVISION MODE: Get field highlight classes ---
  const getFieldHighlightClass = (category) => {
    if (!shouldHighlightField(category)) return '';
    return 'border-amber-500 border-2 ring-2 ring-amber-200';
  };

  // --- REVISION MODE: Render field warning badge ---
  const renderFieldWarning = (category) => {
    if (!shouldHighlightField(category)) return null;
    return (
      <div className="mb-2 p-2 bg-amber-50 border-l-4 border-amber-500 rounded-r text-sm">
        <span className="text-amber-800 font-semibold">⚠️ Perlu dikemaskini</span>
      </div>
    );
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
      const reasonValidation = validateMIAReason(miaReason);
      if (!reasonValidation.valid) {
        errors.push(reasonValidation.error);
      }

      console.log('MIA proofs:', files.mia);
      if (!validateMIAProofs(files.mia)) {
        errors.push('Ketiga-tiga bukti (WhatsApp, E-mel, Panggilan) adalah wajib dimuat naik untuk laporan MIA.');
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
      // Initialize imageUrls with existing URLs in revision mode, empty otherwise
      const imageUrls = {
        gw360: isRevisionMode ? (formData.URL_GAMBAR_GW360 || '') : '',
        sesi: isRevisionMode ? [...(formData.URL_GAMBAR_SESI_JSON || [])] : [],  // Copy existing
        premis: isRevisionMode ? [...(formData.URL_GAMBAR_PREMIS_JSON || [])] : [],
        mia: {
          whatsapp: '',
          email: '',
          call: ''
        }
      };
      const uploadPromises = [];

      // Count total files for logging
      const gw360Count = files.gw360 ? 1 : 0;
      const sesiCount = files.sesi ? files.sesi.length : 0;
      const premisCount = files.premis ? files.premis.length : 0;
      const miaCount = (files.mia.whatsapp ? 1 : 0) + (files.mia.email ? 1 : 0) + (files.mia.call ? 1 : 0);

      console.log(`📊 Image URLs in submission:`);
      console.log(`  - Sesi Images: ${sesiCount}`);
      console.log(`  - Premis Images: ${premisCount}`);
      console.log(`  - GW360 Image: ${gw360Count ? 'Present' : 'Missing'}`);

      const folderId = formData.Folder_ID;
      const menteeNameForUpload = formData.NAMA_MENTEE;
      const sessionNumberForUpload = currentSessionNumber;

      // Check if we have images to upload
      const hasImagesToUpload = files.gw360 || (files.sesi && files.sesi.length > 0) || (files.premis && files.premis.length > 0) || files.mia.whatsapp || files.mia.email || files.mia.call;

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

        // Upload 3 MIA proof images
        if (files.mia.whatsapp) {
          uploadPromises.push(
            uploadImage(files.mia.whatsapp, folderId, menteeNameForUpload, sessionNumberForUpload)
              .then((url) => (imageUrls.mia.whatsapp = url))
          );
        }
        if (files.mia.email) {
          uploadPromises.push(
            uploadImage(files.mia.email, folderId, menteeNameForUpload, sessionNumberForUpload)
              .then((url) => (imageUrls.mia.email = url))
          );
        }
        if (files.mia.call) {
          uploadPromises.push(
            uploadImage(files.mia.call, folderId, menteeNameForUpload, sessionNumberForUpload)
              .then((url) => (imageUrls.mia.call = url))
          );
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
          entrepreneur_id: formData.entrepreneur_id || null,
          NAMA_BISNES: formData.NAMA_BISNES,
          SESI_NUMBER: currentSessionNumber,
          BATCH: formData.BATCH || '', // Added Batch
          PROGRAM: 'MAJU', // Added Program
          emel: formData.emel || '',
          LOKASI_BISNES: formData.LOKASI_BISNES,
          PRODUK_SERVIS: formData.PRODUK_SERVIS,
          NO_TELEFON: formData.NO_TELEFON,
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
          MIA_PROOF_URL: '', // Legacy field - not used, individual URLs sent via imageUrls.mia
          imageUrls: imageUrls, // ✅ MIA proof URLs (whatsapp, email, call)
          batch_round_id: prefillBatchRoundId || null,
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
          entrepreneur_id: formData.entrepreneur_id || null,
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
          LATARBELAKANG_USAHAWAN: formData.LATARBELAKANG_USAHAWAN,
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
          MIA_PROOF_URL: '', // Empty string for non-MIA reports (not the object)
          // KEMASKINI MAKLUMAT - Updated contact information
          KEMASKINI_MAKLUMAT: maklumatBerubah ? formData.KEMASKINI_MAKLUMAT : null,
          batch_round_id: prefillBatchRoundId || null,
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
        // Route to revision API if in revision mode, otherwise normal submit
        const apiUrl = isRevisionMode
          ? `/api/admin/reports/${existingReportId}/revise`
          : '/api/submitMajuReportum';

        response = await fetch(apiUrl, {
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
          message: isRevisionMode ? 'Report updated successfully!' : 'Report submitted successfully!',
          detail: ''
        });

        if (isRevisionMode) {
          // REVISION MODE: Redirect to My Reports page
          setMessage('✅ Laporan telah dikemaskini dan dihantar semula untuk semakan! Mengalihkan ke halaman laporan...');
          setMessageType('success');
          window.scrollTo(0, 0);

          setTimeout(() => {
            router.push('/mentor/my-reports');
          }, 2000);
        } else {
          // NORMAL MODE: Show receipt and reset form
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
        }
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

      setMessage('Gagal menghantar laporan. Sila cuba lagi atau hubungi admin.');
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

        {/* REVISION MODE BANNER */}
        {isRevisionMode && revisionData && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-bold text-amber-900 mb-2">
                  📝 Mod Semakan Semula - Sila Perbaiki Laporan Anda
                </h3>
                <p className="text-sm text-amber-800 mb-3">
                  Laporan anda telah disemak oleh pentadbir dan memerlukan beberapa pembaikan. Sila kemaskini bahagian yang ditandakan di bawah.
                </p>
                <div className="bg-white border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-2">Perkara yang perlu diperbaiki:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                    {(revisionData.revision_reason || []).map((reason, idx) => (
                      <li key={idx} className="font-medium">{reason}</li>
                    ))}
                  </ul>
                  {revisionData.revision_notes && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <p className="text-sm font-semibold text-amber-900">Nota tambahan dari pentadbir:</p>
                      <p className="text-sm text-amber-800 mt-1 italic">&quot;{revisionData.revision_notes}&quot;</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-amber-700 mt-3">
                  ⚠️ Nombor sesi telah dikunci dan tidak boleh diubah. Hanya kemaskini medan yang ditandakan.
                </p>
              </div>
            </div>
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
                  value={isRevisionMode ? `Sesi #${currentSessionNumber} 🔒 (Dikunci)` : `Sesi #${currentSessionNumber}`}
                  disabled
                />
                {isRevisionMode && (
                  <p className="text-xs text-gray-600 mt-1">Nombor sesi tidak boleh diubah dalam mod semakan</p>
                )}
                <TextArea
                  label="Alasan / Sebab Usahawan MIA *"
                  value={miaReason}
                  onChange={(e) => setMiaReason(e.target.value)}
                  placeholder="Cth: Telah dihubungi 3 kali melalui WhatsApp pada 01/08/2025, 03/08/2025, dan 05/08/2025. Dihantar e-mel pada 06/08/2025. Dipanggil 2 kali tetapi tiada jawapan. Usahawan tidak memberikan sebarang maklum balas."
                  required
                />

                <div className="space-y-4 mt-4">
                  <h3 className="font-semibold text-gray-700">Bukti Percubaan Menghubungi (3 jenis diperlukan)</h3>

                  {/* WhatsApp Proof */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <FileInput
                      label={`${MIA_PROOF_TYPES.WHATSAPP.label} *`}
                      onFileChange={(e) => handleMIAFileChange('whatsapp', e.target.files)}
                      required
                      isImageUpload={true}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {MIA_PROOF_TYPES.WHATSAPP.description}
                    </p>
                    {files.mia.whatsapp && (
                      <p className="text-sm text-green-600 mt-2">✓ {files.mia.whatsapp.name}</p>
                    )}
                  </div>

                  {/* Email Proof */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <FileInput
                      label={`${MIA_PROOF_TYPES.EMAIL.label} *`}
                      onFileChange={(e) => handleMIAFileChange('email', e.target.files)}
                      required
                      isImageUpload={true}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {MIA_PROOF_TYPES.EMAIL.description}
                    </p>
                    {files.mia.email && (
                      <p className="text-sm text-green-600 mt-2">✓ {files.mia.email.name}</p>
                    )}
                  </div>

                  {/* Call Proof */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <FileInput
                      label={`${MIA_PROOF_TYPES.CALL.label} *`}
                      onFileChange={(e) => handleMIAFileChange('call', e.target.files)}
                      required
                      isImageUpload={true}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {MIA_PROOF_TYPES.CALL.description}
                    </p>
                    {files.mia.call && (
                      <p className="text-sm text-green-600 mt-2">✓ {files.mia.call.name}</p>
                    )}
                  </div>
                </div>
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

                  {/* Maklumat Berubah - Only show when NOT in MIA mode */}
                  {!isMIA && (
                    <div className="space-y-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={maklumatBerubah}
                          onChange={(e) => {
                            setMaklumatBerubah(e.target.checked);
                            if (!e.target.checked) {
                              // Clear fields when unchecked
                              setFormData(prev => ({
                                ...prev,
                                KEMASKINI_MAKLUMAT: {
                                  telefon_baharu: '',
                                  alamat_baharu: ''
                                }
                              }));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Maklumat Berubah</span>
                      </label>

                      {maklumatBerubah && (
                        <div className="space-y-3 mt-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              No. Telefon Baharu
                            </label>
                            <input
                              type="text"
                              value={formData.KEMASKINI_MAKLUMAT.telefon_baharu}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                KEMASKINI_MAKLUMAT: {
                                  ...prev.KEMASKINI_MAKLUMAT,
                                  telefon_baharu: e.target.value
                                }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Cth: 012-345 6789"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Alamat Baharu
                            </label>
                            <textarea
                              value={formData.KEMASKINI_MAKLUMAT.alamat_baharu}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                KEMASKINI_MAKLUMAT: {
                                  ...prev.KEMASKINI_MAKLUMAT,
                                  alamat_baharu: e.target.value
                                }
                              }))}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Masukkan alamat perniagaan baharu"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <InputField
                    label="Tarikh Sesi"
                    name="TARIKH_SESI"
                    type="date"
                    value={formData.TARIKH_SESI}
                    onChange={handleChange}
                    required
                  />
                  <InputField label="Nombor Sesi" name="SESI_NUMBER_DISPLAY" value={isRevisionMode ? `Sesi #${currentSessionNumber} 🔒 (Dikunci)` : `Sesi #${currentSessionNumber}`} disabled />
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
                  <EnhancedTextArea
                    label="Latar Belakang Usahawan"
                    name="LATARBELAKANG_USAHAWAN"
                    value={formData.LATARBELAKANG_USAHAWAN}
                    onChange={handleChange}
                    required={currentSessionNumber === 1}
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

              <UMSection
                umState={formData.UPWARD_MOBILITY}
                onUmChange={handleUMChange}
                lockedSections={lockedSections}
                onLockSection={handleLockSection}
                praisiDari={praisiDari}
              />


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
                className={`px-6 py-2 text-white rounded-md disabled:bg-gray-400 ${
                  isRevisionMode
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                disabled={loading || compressionProgress.show}
              >
                {compressionProgress.show
                  ? '🔄 Compressing Images...'
                  : loading
                    ? (isRevisionMode ? '📝 Mengemas kini...' : '📤 Submitting...')
                    : (isRevisionMode ? '✏️ Kemaskini Laporan' : 'Submit Laporan Maju')
                }
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
