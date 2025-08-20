// pages/laporan-alt.js
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

// --- UI Components (Simplified for direct inclusion, ideally import from /components) ---
const Section = ({ title, children, description }) => (
  <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
    <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
    {description && (
      <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>
    )}
    <div className="space-y-4">{children}</div>
  </div>
);
const InputField = ({
  label,
  type,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  id,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    />
  </div>
);
const SelectField = ({
  label,
  value,
  onChange,
  children,
  required = true,
  disabled = false,
  id,
  options // For simplicity, added options prop here. You can keep children based too.
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    >
      {options ? options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>) : children}
    </select>
  </div>
);
const TextArea = ({ label, value, onChange, placeholder, rows = 4, required = true, disabled = false }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      required={required}
      disabled={disabled}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    />
  </div>
);
const FileInput = ({ label, multiple = false, onChange, required = false, description }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type="file"
      multiple={multiple}
      onChange={onChange}
      required={required}
      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
    />
    {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
  </div>
);
const InfoCard = ({ title, companyName, address, phone, children, type = 'default' }) => {
    let bgColor, borderColor, textColor;
    switch (type) {
      case 'info':
        bgColor = 'bg-blue-50';
        borderColor = 'border-blue-500';
        textColor = 'text-blue-800';
        break;
      case 'warning':
        bgColor = 'bg-yellow-50';
        borderColor = 'border-yellow-500';
        textColor = 'text-yellow-800';
        break;
      case 'error':
        bgColor = 'bg-red-50';
        borderColor = 'border-red-500';
        textColor = 'text-red-800';
        break;
      default:
        bgColor = 'bg-gray-50';
        borderColor = 'border-gray-300';
        textColor = 'text-gray-800';
    }
    return (
      <div className={`${bgColor} border-l-4 ${borderColor} p-4 rounded-r-lg text-sm`}>
        <h3 className={`text-base font-bold ${textColor} mb-2`}>{title}</h3>
        {companyName && <p><strong>Syarikat:</strong> {companyName || 'N/A'}</p>}
        {address && <p><strong>Alamat:</strong> {address || 'N/A'}</p>}
        {phone && <p><strong>No. Tel:</strong> {phone || 'N/A'}</p>}
        {children}
      </div>
    );
  };

// --- Main Page Component ---
export default function LaporanAltPage() {
  const { data: session, status } = useSession();

  const [allMentees, setAllMentees] = useState([]);
  const [uniqueMentors, setUniqueMentors] = useState([]);
  const [filteredMentees, setFilteredMentees] = useState([]);

  const [selectedAdminMentor, setSelectedAdminMentor] = useState('');
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [currentSessionNumber, setCurrentSessionNumber] = useState(1);
  const [menteeProgramStatus, setMenteeProgramStatus] = useState(''); // e.g., 'Active', 'MIA', 'Completed'

  // History data from backend for display/pre-fill
  const [previousLatarBelakangUsahawan, setPreviousLatarBelakangUsahawan] = useState('');
  const [previousMentoringFindings, setPreviousMentoringFindings] = useState([]);
  const [hasPremisPhotosUploaded, setHasPremisPhotosUploaded] = useState(false);

  const [isMIA, setIsMIA] = useState(false); // Controls if MIA form is shown

  const initialFormState = {
    // Basic Session Info
    TARIKH_SESI: new Date().toISOString().split('T')[0],
    MOD_SESI: 'Face to Face',
    LOKASI_F2F: '',
    MASA_MULA: '',
    MASA_TAMAT: '',

    // Mentee Business Info (pre-filled from mapping, only for display)
    NAMA_BISNES: '',
    LOKASI_BISNES: '',
    PRODUK_SERVIS: '',
    NO_TELEFON: '',

    // Core Report Fields
    LATARBELAKANG_USAHAWAN: '', // Only editable in Sesi 1
    DATA_KEWANGAN_BULANAN_JSON: [],
    MENTORING_FINDINGS_JSON: [{
      'Topik Perbincangan': '',
      'Hasil yang Diharapkan': '',
      'Kemajuan Mentee': '',
      'Cabaran dan Halangan Mentee': '',
      'Pelan Tindakan': [{ Tindakan: '', 'Jangkaan tarikh siap': '', Catatan: '' }],
    }],
    REFLEKSI_MENTOR_PERASAAN: '',
    REFLEKSI_MENTOR_KOMITMEN: '',
    REFLEKSI_MENTOR_LAIN: '',

    // NEW FIELDS for Sesi 2+
    STATUS_PERNIAGAAN_KESELURUHAN: '',
    RUMUSAN_DAN_LANGKAH_KEHADAPAN: '',

    // Image URLs (populated after upload) & associated checks
    URL_GAMBAR_GW360: '', // Sesi 1 only
    URL_GAMBAR_SESI_JSON: [],
    URL_GAMBAR_PREMIS_JSON: [],
    lawatanPremisChecked: false, // UI checkbox state, not directly saved as URL

    // MIA Specific Fields
    MIA_REASON: '',
    MIA_PROOF_URL: '', // populated after upload

    // Hidden fields for backend use
    Mentee_Folder_ID: '',
  };
  const [formState, setFormState] = useState(initialFormState);
  const [files, setFiles] = useState({ gw: null, sesi: [], premis: [], mia: null });

  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // --- Non-blocking toast (yellow notice) ---
  const [toast, setToast] = useState({ show: false, message: '' });
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 4000);
  };

  // --- Autosave (local only) ---
  const getDraftKey = (menteeName, sessionNo, mentorEmail) =>
    `laporanAlt:draft:v1:${mentorEmail || 'unknown'}:${menteeName || 'none'}:s${sessionNo}`;
  const [saveStatus, setSaveStatus] = useState('');
  const [autosaveArmed, setAutosaveArmed] = useState(false);

  const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(session?.user?.email);

  const resetForm = () => {
    try {
      const k = getDraftKey(selectedMentee?.Usahawan, currentSessionNumber, session?.user?.email);
      localStorage.removeItem(k);
    } catch {}

    setFormState(initialFormState);
    setFiles({ gw: null, sesi: [], premis: [], mia: null });
    setSelectedMentee(null);
    setIsMIA(false);
    setPreviousLatarBelakangUsahawan('');
    setPreviousMentoringFindings([]);
    setHasPremisPhotosUploaded(false);
    const menteeSelector = document.getElementById('mentee-selector');
    if (menteeSelector) menteeSelector.value = '';
    if (isAdmin) {
      const mentorSelector = document.getElementById('mentor-selector');
      if (mentorSelector) mentorSelector.value = '';
      setFilteredMentees([]);
      setSelectedAdminMentor('');
    }
    setSaveStatus('');
    setAutosaveArmed(false);
    setError('');
    setSuccess('');
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      if (status === 'authenticated') {
        setIsLoading(true);
        try {
          // Fetch mapping specifically for "maju" program
          const mappingRes = await fetch('/api/mapping?programType=maju');
          const mappingData = await mappingRes.json();
          if (mappingRes.ok) {
            setAllMentees(mappingData);
            if (isAdmin) {
              setUniqueMentors([...new Set(mappingData.map((m) => m.Mentor_Email))].map(email => {
                const mentorInfo = mappingData.find(m => m.Mentor_Email === email);
                return { value: email, label: mentorInfo?.Mentor || email };
              }));
              setFilteredMentees([]);
            } else {
              setFilteredMentees(
                mappingData.filter((m) => m.Mentor_Email === session.user.email)
              );
            }
          }
        } catch (err) {
          setError('Gagal memuatkan data awal usahawan.');
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchInitialData();
  }, [status, session?.user?.email, isAdmin]);

  // --- Autosave effect: save to localStorage on changes ---
  useEffect(() => {
    if (!autosaveArmed) return;
    if (!selectedMentee || !currentSessionNumber) return;

    const draftKey = getDraftKey(selectedMentee?.Usahawan, currentSessionNumber, session?.user?.email);
    const payload = { ...formState };

    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(payload));
        const tStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setSaveStatus(`Saved • ${tStr}`);
      } catch {
        setSaveStatus('Unable to save draft');
      }
    }, 700);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState, selectedMentee, currentSessionNumber, autosaveArmed]);

  const handleAdminMentorChange = (mentorEmail) => {
    setSelectedAdminMentor(mentorEmail);
    setFilteredMentees(allMentees.filter((m) => m.Mentor_Email === mentorEmail));
    setSelectedMentee(null); // Reset selected mentee when mentor changes
    resetForm(); // Also reset form state
  };

  // Helper to safely parse JSON from string
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

  const handleMenteeChange = async (menteeName) => {
    if (!menteeName) {
      resetForm();
      return;
    }
    setIsHistoryLoading(true);
    setError('');
    setSuccess('');

    const menteeDataFromMapping = allMentees.find((m) => m.Usahawan === menteeName);
    setSelectedMentee(menteeDataFromMapping);

    // Reset to initial form state for new mentee, but keep some values
    setFormState(prev => ({
      ...initialFormState,
      TARIKH_SESI: new Date().toISOString().split('T')[0], // Keep current date
      MOD_SESI: 'Face to Face', // Keep default mode
      // Pre-fill mentee business info from mapping
      NAMA_BISNES: menteeDataFromMapping?.Nama_Syarikat || '',
      LOKASI_BISNES: menteeDataFromMapping?.Alamat || '',
      PRODUK_SERVIS: menteeDataFromMapping?.Produk_Servis || '',
      NO_TELEFON: menteeDataFromMapping?.No_Tel || '',
      Mentee_Folder_ID: menteeDataFromMapping?.Folder_ID || '',
    }));
    setPreviousLatarBelakangUsahawan('');
    setPreviousMentoringFindings([]);
    setHasPremisPhotosUploaded(false);
    setIsMIA(false); // Assume not MIA until history says so

    try {
      const res = await fetch(`/api/menteeData?name=${encodeURIComponent(menteeName)}&programType=maju`); // Specify programType for backend
      const data = await res.json();

      if (res.ok) {
        setCurrentSessionNumber(data.currentSession || 1);
        setMenteeProgramStatus(data.status || 'Active'); // 'Active', 'MIA', 'Completed'

        // Set MIA state if reported from backend
        setIsMIA(data.isMIA || false);
        if (data.isMIA) {
          setFormState(p => ({ ...p, MIA_REASON: data.miaReason || '' }));
        }

        // Load previous data for display/pre-fill
        setPreviousLatarBelakangUsahawan(data.latarBelakangUsahawanSesi1 || '');
        setPreviousMentoringFindings(safeJSONParse(data.previousMentoringFindingsJson));
        setHasPremisPhotosUploaded(data.hasPremisPhotos || false);

        setFormState(p => {
          const updatedState = { ...p };

          // If Sesi 1 and previous LATARBELAKANG_USAHAWAN exists, pre-fill it
          if (data.currentSession === 1 && data.latarBelakangUsahawanSesi1) {
            updatedState.LATARBELAKANG_USAHAWAN = data.latarBelakangUsahawanSesi1;
          }

          // Pre-fill financial data from previous submission if it exists
          updatedState.DATA_KEWANGAN_BULANAN_JSON = safeJSONParse(data.previousFinancialDataJson);

          // Restore draft if available for this specific mentee and session
          try {
            const draftKey = getDraftKey(menteeName, data.currentSession, session?.user?.email);
            const saved = localStorage.getItem(draftKey);
            if (saved) {
              const parsed = JSON.parse(saved);
              // Merge parsed draft state, ensuring specific fields from server are prioritized if empty in draft
              Object.assign(updatedState, parsed);
              showToast('Draft laporan dipulihkan.');
            }
          } catch (draftError) {
            console.warn("Could not restore draft:", draftError);
          }
          return updatedState;
        });
        setAutosaveArmed(true); // Start autosaving once mentee is selected
      } else {
        setError(data.error || 'Ralat memuatkan sejarah sesi usahawan.');
      }
    } catch (err) {
      setError('Ralat memuatkan sejarah sesi usahawan: ' + err.message);
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState((p) => ({ ...p, [name]: value }));
  };

  const handleDynamicListChange = (listName, index, field, value) => {
    setFormState((p) => {
      const l = [...(p[listName] || [])];
      // Ensure the object at index exists and has necessary properties
      if (!l[index]) l[index] = {};
      l[index] = { ...l[index], [field]: value };
      return { ...p, [listName]: l };
    });
  };

  const addDynamicListItem = (listName, newItem) => {
    setFormState((p) => ({ ...p, [listName]: [...(p[listName] || []), newItem] }));
  };

  const removeDynamicListItem = (listName, indexToRemove) => {
    setFormState((p) => ({
      ...p,
      [listName]: p[listName].filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleFileChange = async (type, fileList, multiple = false) => {
    if (!selectedMentee || !selectedMentee.Folder_ID) {
      setError('Sila pilih usahawan terlebih dahulu untuk memuat naik gambar.');
      return;
    }

    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;

    setIsSubmitting(true); // Use submitting state for file uploads too
    setError('');
    setSuccess('');

    const uploadedUrls = [];
    const folderId = selectedMentee.Folder_ID;
    const menteeNameForUpload = selectedMentee.Usahawan;
    const sessionNumberForUpload = currentSessionNumber;

    try {
      for (const file of filesToUpload) {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        const url = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            fetch('/api/upload-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileData: reader.result.split(',')[1],
                fileName: file.name,
                fileType: file.type,
                folderId: folderId,
                menteeName: menteeNameForUpload,
                sessionNumber: sessionNumberForUpload,
                reportType: 'maju', // Important: indicate type for backend folder structure
              }),
            })
              .then((res) => res.json())
              .then((result) => {
                if (result.error) reject(new Error(result.error));
                else resolve(result.url);
              })
              .catch(reject);
          };
          reader.onerror = reject;
        });
        uploadedUrls.push(url);
      }

      setFiles((prev) => ({ ...prev, [type]: multiple ? filesToUpload : filesToUpload[0] })); // Keep local file ref
      setFormState((p) => ({
        ...p,
        [`URL_GAMBAR_${type.toUpperCase()}_JSON`]: multiple ? uploadedUrls : uploadedUrls[0], // Store URLs in formState
      }));
      setSuccess(`Gambar ${type} berjaya dimuat naik.`);
    } catch (err) {
      setError(`Gagal memuat naik gambar ${type}: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMentee) {
      setError('Sila pilih usahawan terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    let reportType = 'Selesai';
    let payload = {
      ...formState,
      programType: 'maju', // Explicitly indicate program type for backend
      usahawan: selectedMentee.Usahawan,
      namaSyarikat: selectedMentee.Nama_Syarikat,
      namaMentor: isAdmin ? allMentees.find(m => m.Mentor_Email === selectedAdminMentor)?.Mentor : session?.user?.name,
      mentorEmail: isAdmin ? selectedAdminMentor : session?.user?.email,
      sesiLaporan: currentSessionNumber,
      Mentee_Folder_ID: selectedMentee.Folder_ID, // Ensure folder ID is sent
    };

    if (isMIA) {
      reportType = 'MIA';
      if (!formState.MIA_REASON) {
        setError('Sila berikan alasan untuk status MIA.');
        setIsSubmitting(false);
        return;
      }
      // If MIA proof file exists, upload it
      if (files.mia) {
        try {
          const miaUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(files.mia);
            reader.onloadend = () => {
              fetch('/api/upload-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileData: reader.result.split(',')[1],
                  fileName: files.mia.name,
                  fileType: files.mia.type,
                  folderId: selectedMentee.Folder_ID,
                  menteeName: selectedMentee.Usahawan,
                  sessionNumber: currentSessionNumber,
                  reportType: 'maju',
                  isMIAProof: true, // Special flag for MIA proof
                }),
              })
                .then((res) => res.json())
                .then((result) => {
                  if (result.error) reject(new Error(result.error));
                  else resolve(result.url);
                })
                .catch(reject);
            };
            reader.onerror = reject;
          });
          payload.MIA_PROOF_URL = miaUrl;
        } catch (uploadError) {
          setError('Gagal memuat naik bukti MIA: ' + uploadError.message);
          setIsSubmitting(false);
          return;
        }
      }

      // Clear non-MIA specific fields for MIA report
      payload = {
        ...payload,
        STATUS_PERNIAGAAN_KESELURUHAN: '',
        RUMUSAN_DAN_LANGKAH_KEHADAPAN: '',
        LATARBELAKANG_USAHAWAN: previousLatarBelakangUsahawan, // Keep Sesi 1 background
        DATA_KEWANGAN_BULANAN_JSON: [],
        MENTORING_FINDINGS_JSON: [],
        REFLEKSI_MENTOR_PERASAAN: '',
        REFLEKSI_MENTOR_KOMITMEN: '',
        REFLEKSI_MENTOR_LAIN: '',
        URL_GAMBAR_GW360: '',
        URL_GAMBAR_SESI_JSON: [],
        URL_GAMBAR_PREMIS_JSON: [],
        TARIKH_SESI: '',
        MOD_SESI: '',
        LOKASI_F2F: '',
        MASA_MULA: '',
        MASA_TAMAT: '',
        MIA_STATUS: reportType,
        MIA_REASON: formState.MIA_REASON,
      };
    } else {
      // Regular report validation
      if (!payload.TARIKH_SESI || !payload.MOD_SESI || !payload.MASA_MULA || !payload.MASA_TAMAT) {
        setError('Sila lengkapan maklumat sesi.');
        setIsSubmitting(false);
        return;
      }
      if (payload.MOD_SESI === 'Face to Face' && !payload.LOKASI_F2F) {
        setError('Sila masukkan lokasi untuk sesi Face to Face.');
        setIsSubmitting(false);
        return;
      }
      if (currentSessionNumber === 1 && !payload.LATARBELAKANG_USAHAWAN) {
        setError('Sila isi Latar Belakang Usahawan & Situasi Bisnes untuk Sesi 1.');
        setIsSubmitting(false);
        return;
      }
      if (payload.MENTORING_FINDINGS_JSON.length === 0 || !payload.MENTORING_FINDINGS_JSON[0]['Topik Perbincangan']) {
        setError('Sila tambah sekurang-kurangnya satu Dapatan Sesi Mentoring dengan Topik Perbincangan.');
        setIsSubmitting(false);
        return;
      }
      if (!payload.REFLEKSI_MENTOR_PERASAAN || !payload.REFLEKSI_MENTOR_KOMITMEN) {
        setError('Sila isi Refleksi Mentor: Perasaan dan Komitmen.');
        setIsSubmitting(false);
        return;
      }

      // Image validation for non-MIA reports
      if (currentSessionNumber === 1 && !payload.URL_GAMBAR_GW360) {
          setError('Sila muat naik Gambar GW360 untuk Sesi 1.');
          setIsSubmitting(false);
          return;
      }
      if (payload.URL_GAMBAR_SESI_JSON.length === 0) {
          setError('Sila muat naik sekurang-kurangnya satu Gambar Sesi Mentoring.');
          setIsSubmitting(false);
          return;
      }
      if (payload.lawatanPremisChecked && payload.URL_GAMBAR_PREMIS_JSON.length === 0) {
          setError("Sila muat naik Gambar Premis kerana 'Lawatan Premis' ditandakan.");
          setIsSubmitting(false);
          return;
      }

      // Important: Ensure LATARBELAKANG_USAHAWAN is saved from previous session for Sesi 2+
      payload.LATARBELAKANG_USAHAWAN = currentSessionNumber === 1
        ? payload.LATARBELAKANG_USAHAWAN
        : previousLatarBelakangUsahawan;

      payload.MIA_STATUS = 'Tidak MIA';
      payload.MIA_REASON = '';
      payload.MIA_PROOF_URL = '';
    }

    try {
      // Send the report data to the unified submitReport API
      const response = await fetch('/api/submitReport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menghantar laporan.');
      }

      setSuccess('Laporan berjaya dihantar! Borang akan direset.');
      window.scrollTo(0, 0);
      setTimeout(() => {
        resetForm();
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.message);
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render components
  if (!session) {
    return (
      <div className="bg-gray-100 min-h-screen font-sans flex items-center justify-center">
        <InfoCard title="Authentication Required" type="info">
          Please log in to access this page.
        </InfoCard>
      </div>
    );
  }

  // Display message if all sessions are completed
  if (currentSessionNumber > 4 && selectedMentee) { // Assuming 4 sessions max for Maju
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
                Semua sesi mentoring untuk <strong>{selectedMentee.Usahawan}</strong> telah lengkap (Sesi 1 hingga 4 telah direkodkan).
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
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <header className="text-center bg-white p-6 rounded-lg shadow-sm relative">
          <img src="/logo1.png" alt="iTEKAD Logos" className="mx-auto h-20 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">Borang Laporan Maju</h1>
          <p className="text-gray-500 mt-1">Sila lengkapkan borang berdasarkan sesi semasa.</p>

          {/* Non-blocking toast */}
          {toast.show && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 bg-yellow-100 border border-yellow-300 text-yellow-900 px-4 py-2 rounded shadow text-sm z-10">
              {toast.message}
            </div>
          )}
        </header>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
            <p className="font-bold">Ralat</p>
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
            <p className="font-bold">Berjaya</p>
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Section title="1. Pemilihan Usahawan">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isAdmin ? (
                <SelectField
                  id="mentor-selector"
                  label="Pilih Mentor (Admin)"
                  value={selectedAdminMentor}
                  onChange={(e) => handleAdminMentorChange(e.target.value)}
                  options={[{ label: '-- Sila Pilih Mentor --', value: '' }, ...uniqueMentors]}
                  required
                />
              ) : (
                <InputField label="Nama Mentor" value={session?.user?.name || ''} disabled />
              )}
              <SelectField
                id="mentee-selector"
                label="Pilih Usahawan (Mentee)"
                value={selectedMentee?.Usahawan || ''}
                onChange={(e) => handleMenteeChange(e.target.value)}
                options={[
                  { label: '-- Sila Pilih Usahawan --', value: '' },
                  ...filteredMentees.map(m => ({ label: m.Usahawan, value: m.Usahawan }))
                ]}
                required
                disabled={isAdmin && !selectedAdminMentor}
              />
            </div>
            {selectedMentee && (
              <div className="text-center mt-6">
                <span className="text-lg font-bold text-white bg-blue-600 px-4 py-2 rounded-full">Sesi #{currentSessionNumber}</span>
              </div>
            )}
          </Section>

          {selectedMentee && menteeProgramStatus === 'MIA' ? (
            <Section title="Status Usahawan">
              <InfoCard title="Usahawan ini telah ditandakan sebagai MIA." type="info">
                <p>Anda hanya boleh menghantar laporan MIA untuk mentee ini.</p>
                <p>Sila nyatakan alasan dan muat naik bukti.</p>
              </InfoCard>
            </Section>
          ) : (
            selectedMentee && (
              <>
                <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-center">
                  <input type="checkbox" id="mia-checkbox" checked={isMIA} onChange={(e) => setIsMIA(e.target.checked)} className="h-5 w-5 rounded text-red-600 focus:ring-red-500" />
                  <label htmlFor="mia-checkbox" className="ml-3 font-semibold text-gray-700">Tandakan jika Usahawan Tidak Hadir / MIA</label>
                </div>

                {isHistoryLoading ? (
                  <div className="text-center p-4">Memuatkan sejarah sesi...</div>
                ) : isMIA ? (
                  // MIA Form
                  <Section title={`Laporan Status MIA - Sesi #${currentSessionNumber}`}>
                    <TextArea
                      label="Alasan / Sebab Usahawan MIA"
                      value={formState.MIA_REASON}
                      onChange={(e) => setFormState(p => ({ ...p, MIA_REASON: e.target.value }))}
                      placeholder="Cth: Telah dihubungi 3 kali melalui WhatsApp pada 01/08/2025, tiada jawapan."
                      required
                    />
                    <FileInput
                      label="Muat Naik Bukti (Cth: Screenshot Perbualan)"
                      onChange={(e) => setFiles(p => ({ ...p, mia: e.target.files[0] }))}
                    />
                    {files.mia && (
                        <p className="text-sm text-gray-600 mt-1">File selected: {files.mia.name}</p>
                    )}
                  </Section>
                ) : (
                  // Regular Report Form
                  <div className="space-y-6">
                    <Section title={`Maklumat Sesi ${currentSessionNumber}`}>
                      <InfoCard
                        title="Maklumat Usahawan"
                        companyName={selectedMentee.Nama_Syarikat}
                        address={selectedMentee.Alamat}
                        phone={selectedMentee.No_Tel}
                      >
                        <p><strong>Jenis Bisnes:</strong> {selectedMentee.Jenis_Bisnes || 'N/A'}</p>
                        <p><strong>Produk/Servis Utama:</strong> {selectedMentee.Produk_Servis || 'N/A'}</p>
                      </InfoCard>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <InputField label="Tarikh Sesi" type="date" name="TARIKH_SESI" value={formState.TARIKH_SESI} onChange={handleInputChange} required />
                        <SelectField label="Mod Sesi / Platform" name="MOD_SESI" value={formState.MOD_SESI} onChange={handleInputChange} required>
                          <option>Face to Face</option>
                          <option>Online</option>
                        </SelectField>
                      </div>
                      {formState.MOD_SESI === 'Face to Face' && (
                        <div className="mt-4">
                          <InputField label="Lokasi Sesi (Jika F2F)" name="LOKASI_F2F" value={formState.LOKASI_F2F} onChange={handleInputChange} placeholder="Cth: Pejabat usahawan, ABC Cafe" required />
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <InputField label="Masa Mula Sesi" type="time" name="MASA_MULA" value={formState.MASA_MULA} onChange={handleInputChange} required />
                        <InputField label="Masa Tamat Sesi" type="time" name="MASA_TAMAT" value={formState.MASA_TAMAT} onChange={handleInputChange} required />
                      </div>
                    </Section>

                    {/* LATARBELAKANG_USAHAWAN (Sesi 1 only editable) */}
                    <Section title="Latar Belakang Usahawan & Situasi Bisnes">
                        {currentSessionNumber > 1 && previousLatarBelakangUsahawan && (
                            <InfoCard title="Ringkasan Latar Belakang Usahawan (Sesi 1)" type="info">
                                <p className="whitespace-pre-wrap">{previousLatarBelakangUsahawan}</p>
                            </InfoCard>
                        )}
                        <TextArea
                            label="Latar Belakang Usahawan"
                            name="LATARBELAKANG_USAHAWAN"
                            value={currentSessionNumber === 1 ? formState.LATARBELAKANG_USAHAWAN : previousLatarBelakangUsahawan}
                            onChange={handleInputChange}
                            required={currentSessionNumber === 1}
                            disabled={currentSessionNumber > 1}
                            rows={8}
                            placeholder={currentSessionNumber === 1 ? `Panduan:
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
- Peningkatan skil/pengetahuan` : 'Latar Belakang Usahawan can only be edited in Sesi 1. Displaying previous entry.'}
                        />
                    </Section>

                    {/* DATA_KEWANGAN_BULANAN_JSON */}
                    <Section title="Data Kewangan Bulanan">
                        {(formState.DATA_KEWANGAN_BULANAN_JSON || []).map((data, index) => (
                            <div key={index} className="border p-4 mb-4 rounded-md bg-gray-50">
                                <h4 className="font-semibold text-gray-700 mb-2">Data Bulan #{index + 1}</h4>
                                <InputField label="Bulan (Cth: Januari 2024)" value={data.Bulan || ''} onChange={(e) => handleDynamicListChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Bulan', e.target.value)} />
                                <InputField label="Jumlah Jualan (RM)" type="number" value={data['Jumlah Jualan'] || ''} onChange={(e) => handleDynamicListChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Jumlah Jualan', parseFloat(e.target.value) || 0)} />
                                <InputField label="Kos Jualan (RM)" type="number" value={data['Kos Jualan'] || ''} onChange={(e) => handleDynamicListChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Kos Jualan', parseFloat(e.target.value) || 0)} />
                                <InputField label="Perbelanjaan Tetap (RM)" type="number" value={data['Perbelanjaan Tetap'] || ''} onChange={(e) => handleDynamicListChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Perbelanjaan Tetap', parseFloat(e.target.value) || 0)} />
                                <InputField label="Lebihan Tunai (RM)" type="number" value={data['Lebihan Tunai'] || ''} onChange={(e) => handleDynamicListChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Lebihan Tunai', parseFloat(e.target.value) || 0)} />
                                <TextArea label="Ulasan Mentor" value={data['Ulasan Mentor'] || ''} onChange={(e) => handleDynamicListChange('DATA_KEWANGAN_BULANAN_JSON', index, 'Ulasan Mentor', e.target.value)} rows={2} />
                                <button type="button" onClick={() => removeDynamicListItem('DATA_KEWANGAN_BULANAN_JSON', index)} className="mt-2 bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">Buang Data Bulan</button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addDynamicListItem('DATA_KEWANGAN_BULANAN_JSON', { Bulan: '', 'Jumlah Jualan': '', 'Kos Jualan': '', 'Perbelanjaan Tetap': '', 'Lebihan Tunai': '', 'Ulasan Mentor': '' })} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Tambah Data Bulan</button>
                    </Section>

                    {/* MENTORING_FINDINGS_JSON */}
                    <Section title="Dapatan Sesi Mentoring">
                        {currentSessionNumber > 1 && previousMentoringFindings.length > 0 && (
                            <InfoCard title={`Ringkasan Inisiatif Sesi Lalu (Sesi #${currentSessionNumber - 1})`} type="info">
                                <ul className="list-disc pl-5">
                                    {previousMentoringFindings.map((finding, index) => (
                                        <li key={index} className="mb-2">
                                            <p className="font-semibold">{finding['Topik Perbincangan']}</p>
                                            <p>Hasil Diharapkan: {finding['Hasil yang Diharapkan']}</p>
                                            <p>Kemajuan: {finding['Kemajuan Mentee']}</p>
                                            <p>Cabaran: {finding['Cabaran dan Halangan Mentee']}</p>
                                            {finding['Pelan Tindakan'] && Array.isArray(finding['Pelan Tindakan']) && finding['Pelan Tindakan'].length > 0 && (
                                                <ul className="list-disc list-inside pl-5 mt-1 text-sm text-gray-600">
                                                    {finding['Pelan Tindakan'].map((plan, pIndex) => (
                                                        <li key={pIndex}>
                                                            {plan.Tindakan} (Jangkaan Siap: {plan['Jangkaan tarikh siap'] || 'N/A'}) - {plan.Catatan}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </InfoCard>
                        )}
                        {(formState.MENTORING_FINDINGS_JSON || []).map((finding, index) => (
                            <div key={index} className="border p-4 mb-4 rounded-md bg-gray-50">
                                <h4 className="font-semibold text-gray-700 mb-2">Dapatan Mentoring #{index + 1}</h4>
                                <InputField label="Topik Perbincangan" value={finding['Topik Perbincangan'] || ''} onChange={(e) => handleDynamicListChange('MENTORING_FINDINGS_JSON', index, 'Topik Perbincangan', e.target.value)} />
                                <InputField label="Hasil yang Diharapkan" value={finding['Hasil yang Diharapkan'] || ''} onChange={(e) => handleDynamicListChange('MENTORING_FINDINGS_JSON', index, 'Hasil yang Diharapkan', e.target.value)} />
                                <TextArea label="Kemajuan Mentee" value={finding['Kemajuan Mentee'] || ''} onChange={(e) => handleDynamicListChange('MENTORING_FINDINGS_JSON', index, 'Kemajuan Mentee', e.target.value)} rows={3} />
                                <TextArea label="Cabaran dan Halangan Mentee" value={finding['Cabaran dan Halangan Mentee'] || ''} onChange={(e) => handleDynamicListChange('MENTORING_FINDINGS_JSON', index, 'Cabaran dan Halangan Mentee', e.target.value)} rows={3} />

                                <h5 className="font-semibold mt-4 mb-2">Pelan Tindakan</h5>
                                {(finding['Pelan Tindakan'] || []).map((plan, pIndex) => (
                                    <div key={pIndex} className="border p-3 mb-2 rounded-md bg-gray-100">
                                        <InputField label="Tindakan" value={plan.Tindakan || ''} onChange={(e) => {
                                            const updatedFindings = [...formState.MENTORING_FINDINGS_JSON];
                                            if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                                            updatedFindings[index]['Pelan Tindakan'][pIndex].Tindakan = e.target.value;
                                            setFormState(p => ({ ...p, MENTORING_FINDINGS_JSON: updatedFindings }));
                                        }} />
                                        <InputField label="Jangkaan Tarikh Siap" type="date" value={plan['Jangkaan tarikh siap'] || ''} onChange={(e) => {
                                            const updatedFindings = [...formState.MENTORING_FINDINGS_JSON];
                                            if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                                            updatedFindings[index]['Pelan Tindakan'][pIndex]['Jangkaan tarikh siap'] = e.target.value;
                                            setFormState(p => ({ ...p, MENTORING_FINDINGS_JSON: updatedFindings }));
                                        }} />
                                        <TextArea label="Catatan" value={plan.Catatan || ''} onChange={(e) => {
                                            const updatedFindings = [...formState.MENTORING_FINDINGS_JSON];
                                            if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                                            updatedFindings[index]['Pelan Tindakan'][pIndex].Catatan = e.target.value;
                                            setFormState(p => ({ ...p, MENTORING_FINDINGS_JSON: updatedFindings }));
                                        }} rows={2} />
                                        <button type="button" onClick={() => {
                                            const updatedFindings = [...formState.MENTORING_FINDINGS_JSON];
                                            if (!updatedFindings[index] || !updatedFindings[index]['Pelan Tindakan']) return;
                                            updatedFindings[index]['Pelan Tindakan'] =
                                                updatedFindings[index]['Pelan Tindakan'].filter((_, i) => i !== pIndex);
                                            setFormState(p => ({ ...p, MENTORING_FINDINGS_JSON: updatedFindings }));
                                        }} className="mt-2 bg-red-400 text-white px-2 py-1 rounded-md text-xs hover:bg-red-500">Buang Pelan Tindakan</button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => {
                                    const updatedFindings = [...formState.MENTORING_FINDINGS_JSON];
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
                                    updatedFindings[index]['Pelan Tindakan'].push({ Tindakan: '', 'Jangkaan tarikh siap': '', Catatan: '' });
                                    setFormState(p => ({ ...p, MENTORING_FINDINGS_JSON: updatedFindings }));
                                }} className="mt-2 bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600">Tambah Pelan Tindakan</button>

                                <button type="button" onClick={() => removeDynamicListItem('MENTORING_FINDINGS_JSON', index)} className="mt-4 bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">Buang Dapatan Mentoring</button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addDynamicListItem('MENTORING_FINDINGS_JSON', { 'Topik Perbincangan': '', 'Hasil yang Diharapkan': '', 'Kemajuan Mentee': '', 'Cabaran dan Halangan Mentee': '', 'Pelan Tindakan': [] })} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Tambah Dapatan Mentoring</button>
                    </Section>

                    {/* New Fields for Sesi 2+ */}
                    {currentSessionNumber >= 2 && (
                        <>
                            <Section title="Status Perniagaan Keseluruhan" description="Pemerhatian Mentor/Coach tentang situasi bisnes.">
                                <TextArea
                                    label="Pemerhatian Status Perniagaan Keseluruhan"
                                    name="STATUS_PERNIAGAAN_KESELURUHAN"
                                    value={formState.STATUS_PERNIAGAAN_KESELURUHAN}
                                    onChange={handleInputChange}
                                    rows={6}
                                    placeholder={`Panduan:
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

                            <Section title="Rumusan Keseluruhan dan Langkah Kehadapan">
                                <TextArea
                                    label="Rumusan Keseluruhan dan Langkah Kehadapan"
                                    name="RUMUSAN_DAN_LANGKAH_KEHADAPAN"
                                    value={formState.RUMUSAN_DAN_LANGKAH_KEHADAPAN}
                                    onChange={handleInputChange}
                                    rows={8}
                                    placeholder={`Nota:
Pastikan peserta pulang dengan Keputusan dan Tindakan yang perlu diusahakan, siapa dan bila. (Kongsikan/pastikan usahawan juga jelas)
Apakah ada homework untuk peserta.
Sebaiknya, tetapkan masa pertemuan sesi akan datang, dan mod perbincangan.
Apakah bantuan, latihan yang mahu dicadangkan kepada HQ untuk membantu usahawan.
Apakah mentor ada bahan tambahan yang dapat membantu usahawan.
Apakah mentor perlukan bahan tambahan/bantuan dari mentor mentor lain atau HQ.
Rumus poin-poin penting yang perlu diberi perhatian atau penekanan baik isu berkaitan bisnes mahupun tingkahlaku atau komitmen peserta.`}
                                />
                            </Section>
                        </>
                    )}

                    {/* REFLEKSI_MENTOR */}
                    <Section title="Refleksi Mentor" description="Refleksi jujur untuk penambahbaikan diri selaku mentor.">
                        <TextArea label="Apa perasan sebelum dan selepas sesi?" name="REFLEKSI_MENTOR_PERASAAN" value={formState.REFLEKSI_MENTOR_PERASAAN} onChange={handleInputChange} required />
                        <TextArea label="Komitmen Mentor Untuk Menolong Mentee" name="REFLEKSI_MENTOR_KOMITMEN" value={formState.REFLEKSI_MENTOR_KOMITMEN} onChange={handleInputChange} required />
                        <TextArea label="Lain-lain Catatan Refleksi Mentor" name="REFLEKSI_MENTOR_LAIN" value={formState.REFLEKSI_MENTOR_LAIN} onChange={handleInputChange} />
                    </Section>

                    {/* Lampiran Gambar */}
                    <Section title="Lampiran Gambar">
                        {currentSessionNumber === 1 && (
                            <FileInput
                                label="Gambar GW360 (Sesi 1 Sahaja)"
                                onChange={(e) => handleFileChange('gw', e.target.files)}
                                required={currentSessionNumber === 1}
                                description={formState.URL_GAMBAR_GW360 ? `Uploaded: ${formState.URL_GAMBAR_GW360.substring(0, 50)}...` : ''}
                            />
                        )}
                        <FileInput
                            label="Gambar Sesi Mentoring (Pelbagai Gambar)"
                            multiple
                            onChange={(e) => handleFileChange('sesi', e.target.files, true)}
                            required
                            description={formState.URL_GAMBAR_SESI_JSON.length > 0 ? `Uploaded: ${formState.URL_GAMBAR_SESI_JSON.length} images` : ''}
                        />

                        {!hasPremisPhotosUploaded && (
                            <div className="mt-4">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-5 w-5 text-blue-600"
                                        checked={formState.lawatanPremisChecked}
                                        onChange={(e) => setFormState(p => ({ ...p, lawatanPremisChecked: e.target.checked }))}
                                    />
                                    <span className="ml-2 text-gray-700 font-medium">Premis dilawat semasa sesi ini</span>
                                </label>
                                {formState.lawatanPremisChecked && (
                                    <FileInput
                                        label="Gambar Premis Perniagaan (2 Gambar)"
                                        multiple
                                        onChange={(e) => handleFileChange('premis', e.target.files, true)}
                                        required={formState.lawatanPremisChecked}
                                        description={formState.URL_GAMBAR_PREMIS_JSON.length > 0 ? `Uploaded: ${formState.URL_GAMBAR_PREMIS_JSON.length} images` : ''}
                                    />
                                )}
                            </div>
                        )}
                        {hasPremisPhotosUploaded && (
                            <InfoCard title="Lawatan Premis" type="info">
                                Lawatan Premis telah direkodkan pada sesi sebelumnya.
                            </InfoCard>
                        )}
                    </Section>

                    {/* Upward Mobility Reminder */}
                    {(currentSessionNumber === 2 || currentSessionNumber === 4) && (
                        <Section title="Bahagian Upward Mobility">
                            <InfoCard title="Peringatan Penting" type="info">
                                <p>[SESI 2 & 4 SAHAJA] Sila lengkapkan borang Google Forms Upward Mobility di pautan berikut:</p>
                                <a
                                    href="YOUR_UPWARD_MOBILITY_GOOGLE_FORM_LINK_HERE" // REPLACE WITH ACTUAL LINK
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-medium"
                                >
                                    Link to Upward Mobility Google Form
                                </a>
                            </InfoCard>
                        </Section>
                    )}
                  </div>
                )}
              </>
            )
          )}

          {selectedMentee && menteeProgramStatus !== 'MIA' && (
            <div className="mt-6 pt-6 border-t text-center">
              <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-green-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                {isSubmitting ? 'Menghantar...' : `Hantar Laporan Sesi ${currentSessionNumber}`}
              </button>
              {saveStatus && <div className="mt-2 text-xs text-gray-500">{saveStatus}</div>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}