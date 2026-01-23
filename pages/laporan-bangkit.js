// pages/laporan-sesi.js
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';


// ADD this helper function at the top of your laporan-sesi.js file:



// --- UI Components ---
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
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <input
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
      {children}
    </select>
  </div>
);
const TextArea = ({ label, value, onChange, placeholder, helperText, rows = 4, required = true }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    {helperText && (
      <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-gray-700 whitespace-pre-line">
        {helperText}
      </div>
    )}
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder || 'Taip respons anda di sini...'}
      rows={rows}
      required={required}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);
const FileInput = ({ label, multiple = false, onChange, required = false }) => (
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
  </div>
);
const InfoCard = ({ companyName, address, phone }) => (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg text-sm">
    <h3 className="text-base font-bold text-gray-800 mb-2">Maklumat Usahawan</h3>
    <p><strong>Syarikat:</strong> {companyName || 'N/A'}</p>
    <p><strong>Alamat:</strong> {address || 'N/A'}</p>
    <p><strong>No. Tel:</strong> {phone || 'N/A'}</p>
  </div>
);

// --- Main Page Component ---
export default function LaporanSesiPage() {
  const { data: session, status } = useSession();

  const [allMentees, setAllMentees] = useState([]);
  const [uniqueMentors, setUniqueMentors] = useState([]);
  const [filteredMentees, setFilteredMentees] = useState([]);

  const [frameworkData, setFrameworkData] = useState([]);
  const [selectedAdminMentor, setSelectedAdminMentor] = useState('');
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [currentSession, setCurrentSession] = useState(1);
  const [menteeStatus, setMenteeStatus] = useState('');
  const [isMIA, setIsMIA] = useState(false);
  const [previousData, setPreviousData] = useState({ sales: [], inisiatif: [], premisDilawat: false });

  const initialFormState = {
    inisiatif: [{ focusArea: '', keputusan: '', keputusanCustom: undefined, pelanTindakan: '' }],
    kemaskiniInisiatif: [],
    teknologi: [{ sistem: '', tujuan: '' }],
    jualanTahunSebelum: { tahun: new Date().getFullYear() - 1, setahun: '', bulananMin: '', bulananMaks: '' },
    jualanTerkini: Array(12).fill(''),
    pemerhatian: '',
    rumusan: '',
    rumusanSesi2Plus: '',
    refleksi: { perasaan: '', skor: '', alasan: '', eliminate: '', raise: '', reduce: '', create: '' },
    sesi: { date: new Date().toISOString().split('T')[0], time: '', platform: 'Face to Face', lokasiF2F: '', premisDilawat: false },
    tambahan: { jenisBisnes: '', produkServis: '', pautanMediaSosial: '' },
    mia: { alasan: '' },
    // UPWARD MOBILITY FIELDS (MANDATORY for ALL Bangkit sessions)
    upwardMobility: {
      // Section 1: Engagement Status
      UM_STATUS_PENGLIBATAN: '',
      UM_STATUS: '',
      UM_KRITERIA_IMPROVEMENT: '',
      // Section 2: BIMB Channels & Fintech
      UM_AKAUN_BIMB: '',
      UM_BIMB_BIZ: '',
      UM_AL_AWFAR: '',
      UM_MERCHANT_TERMINAL: '',
      UM_FASILITI_LAIN: '',
      UM_MESINKIRA: '',
      // Section 3: Financial & Employment Metrics
      UM_PENDAPATAN_SEMASA: '',
      UM_ULASAN_PENDAPATAN: '',
      UM_PEKERJA_SEMASA: '',
      UM_ULASAN_PEKERJA: '',
      UM_ASET_BUKAN_TUNAI_SEMASA: '',
      UM_ULASAN_ASET_BUKAN_TUNAI: '',
      UM_ASET_TUNAI_SEMASA: '',
      UM_ULASAN_ASET_TUNAI: '',
      UM_SIMPANAN_SEMASA: '',
      UM_ULASAN_SIMPANAN: '',
      UM_ZAKAT_SEMASA: '',
      UM_ULASAN_ZAKAT: '',
      // Section 4: Digitalization
      UM_DIGITAL_SEMASA: [],
      UM_ULASAN_DIGITAL: '',
      // Section 5: Marketing (checkboxes - required)
      UM_MARKETING_SEMASA: [],
      UM_ULASAN_MARKETING: '',
      // Section 6: Premises Visit Date (optional)
      UM_TARIKH_LAWATAN_PREMIS: '',
    },
  };
  const [formState, setFormState] = useState(initialFormState);
  const [files, setFiles] = useState({ gw: null, profil: null, sesi: [], premis: [], mia: null });

  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [compressionProgress, setCompressionProgress] = useState({ show: false, current: 0, total: 0, message: '', fileName: '' });
  const [submissionStage, setSubmissionStage] = useState({ stage: '', message: '', detail: '' });

  // --- Non-blocking toast (yellow notice) ---
  const [toast, setToast] = useState({ show: false, message: '' });
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 4000);
  };

  // --- Autosave (local only) ---
  const getDraftKey = (menteeName, sessionNo, mentorEmail) =>
    `laporanSesi:draft:v1:${mentorEmail || 'unknown'}:${menteeName || 'none'}:s${sessionNo}`;
  const [saveStatus, setSaveStatus] = useState('');
  const [autosaveArmed, setAutosaveArmed] = useState(false);

  const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(session?.user?.email);

  const resetForm = () => {
    try {
      const k = getDraftKey(selectedMentee?.Usahawan, currentSession, session?.user?.email);
      localStorage.removeItem(k);
    } catch {}

    setFormState(initialFormState);
    setFiles({ gw: null, profil: null, sesi: [], premis: [], mia: null });
    setSelectedMentee(null);
    setIsMIA(false);
    setPreviousData({ sales: [], inisiatif: [], premisDilawat: false });
    const menteeSelector = document.getElementById('mentee-selector');
    if (menteeSelector) menteeSelector.value = '';
    if (isAdmin) {
      const mentorSelector = document.getElementById('mentor-selector');
      if (mentorSelector) mentorSelector.value = '';
      setFilteredMentees([]);
    }
    setSaveStatus('');
    setAutosaveArmed(false);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      if (status === 'authenticated') {
        setIsLoading(true);
        try {
          const [mappingRes, frameworkRes] = await Promise.all([
            fetch('/api/mapping?programType=bangkit'),
            fetch('/api/frameworkBank'),
          ]);
          const mappingData = await mappingRes.json();
          if (mappingRes.ok) {
            setAllMentees(mappingData);
            if (isAdmin) {
              setUniqueMentors([...new Set(mappingData.map((m) => m.Mentor))]);
              setFilteredMentees([]);
            } else {
              setFilteredMentees(
                mappingData.filter((m) => m.Mentor_Email === session.user.email)
              );
            }
          }
          const framework = await frameworkRes.json();
          if (frameworkRes.ok) setFrameworkData(framework);
        } catch (err) {
          setError('Gagal memuatkan data awal.');
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
    if (!selectedMentee || !currentSession) return;

    const draftKey = getDraftKey(selectedMentee?.Usahawan, currentSession, session?.user?.email);
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
  }, [formState, selectedMentee, currentSession, autosaveArmed]);

  const handleAdminMentorChange = (mentorName) => {
    setSelectedAdminMentor(mentorName);
    setFilteredMentees(allMentees.filter((m) => m.Mentor === mentorName));
    setSelectedMentee(null);
    setAutosaveArmed(false);
  };

  // --- Helper: normalize previous inisiatif from backend to text labels
  const normalizePrevInisiatif = (raw, framework) => {
    const focusAreas = [...new Set(framework.map(f => f.Focus_Area))];
    const isNum = (v) => typeof v === 'number' || (/^\d+$/).test(String(v ?? '').trim());

    return (raw || []).map((it) => {
      let fa = (it?.focusArea ?? it?.Fokus_Area ?? it?.['Fokus Area'] ?? it?.[0] ?? '').toString();
      let kp = (it?.keputusan ?? it?.Keputusan ?? it?.['Keputusan'] ?? it?.[1] ?? '').toString();
      let pt = (it?.pelanTindakan ?? it?.Pelan_Tindakan ?? it?.['Pelan Tindakan'] ?? it?.[2] ?? '').toString();

      if (isNum(fa)) {
        const faIdx = Number(fa) - 1;
        fa = focusAreas[faIdx] || fa;
      }
      if (isNum(kp)) {
        const kpCandidates = framework.filter(f => f.Focus_Area === fa).map(f => f.Keputusan);
        const kpIdx = Number(kp) - 1;
        kp = kpCandidates[kpIdx] || kp;
      }

      return { focusArea: fa, keputusan: kp, pelanTindakan: pt };
    });
  };

  const handleMenteeChange = async (menteeName) => {
    if (!menteeName) {
      resetForm();
      return;
    }
    setIsHistoryLoading(true);
    setFormState(initialFormState);
    const menteeData = allMentees.find((m) => m.Usahawan === menteeName);
    setSelectedMentee(menteeData);
    try {
      const res = await fetch(`/api/menteeData?name=${encodeURIComponent(menteeName)}&programType=bangkit`);
      const data = await res.json();

      let fw = frameworkData;
      if (!fw || fw.length === 0) {
        const fwRes = await fetch('/api/frameworkBank');
        fw = await fwRes.json();
      }

      const prevInisiatif = normalizePrevInisiatif(data.previousInisiatif || [], fw);

      setPreviousData({
        sales: data.previousSales || [],
        inisiatif: prevInisiatif,
        premisDilawat: !!data.previousPremisDilawat,
      });
      setFormState(p => ({
        ...p,
        jualanTerkini: data.previousSales || Array(12).fill(''),
        kemaskiniInisiatif: Array(prevInisiatif.length).fill(''),
      }));
      
      if (res.ok) {
        setCurrentSession(data.lastSession + 1);
        setMenteeStatus(data.status || '');

        // --- Restore draft
        try {
          const draftKey = getDraftKey(menteeName, data.lastSession + 1, session?.user?.email);
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            setFormState(prev => ({
              ...prev,
              ...parsed,
              // keep server's previousSales if draft has nothing/empty
              jualanTerkini: (Array.isArray(parsed.jualanTerkini) && parsed.jualanTerkini.some(v => v))
                ? parsed.jualanTerkini
                : (data.previousSales || prev.jualanTerkini),
            }));
            setSaveStatus('Draft restored');
          }
        } catch {}
        setAutosaveArmed(true);
      }
    } catch (err) {
      setError('Ralat memuatkan sejarah sesi.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleInputChange = (section, field, value) =>
    setFormState((p) => ({ ...p, [section]: { ...p[section], [field]: value } }));
  const handleDynamicListChange = (listName, index, field, value) =>
    setFormState((p) => {
      const l = [...(p[listName] || [])];
      l[index] = { ...l[index], [field]: value };
      return { ...p, [listName]: l };
    });
  // Handler for UPWARD_MOBILITY nested fields
  const handleUMChange = (field, value) => {
    setFormState((p) => ({
      ...p,
      upwardMobility: {
        ...p.upwardMobility,
        [field]: value
      }
    }));
  };
  const addDynamicListItem = (listName, newItem) =>
    setFormState((p) => ({ ...p, [listName]: [...(p[listName] || []), newItem] }));
  const handleInisiatifChange = (index, field, value) =>
    setFormState((p) => {
      const l = [...(p.inisiatif || [])];
      const u = { ...l[index], [field]: value };
      if (field === 'focusArea') {
        u.keputusan = '';
        u.keputusanCustom = undefined;
      }
      l[index] = u;
      return { ...p, inisiatif: l };
    });
  const addInisiatif = () => {
    if ((formState.inisiatif || []).length < 4)
      addDynamicListItem('inisiatif', { focusArea: '', keputusan: '', keputusanCustom: undefined, pelanTindakan: '' });
  };
  const handleFileChange = (type, fileList, multiple = false) =>
    setFiles((prev) => ({ ...prev, [type]: multiple ? Array.from(fileList) : fileList[0] }));

  const handleKemaskiniChange = (index, value) => {
    setFormState((p) => {
      const newKemaskini = [...p.kemaskiniInisiatif];
      newKemaskini[index] = value;
      return { ...p, kemaskiniInisiatif: newKemaskini };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // IMMEDIATELY disable button to prevent double-click
    if (isSubmitting) {
      console.warn('⚠️ Submission already in progress, ignoring duplicate click');
      return;
    }
    setIsSubmitting(true);

    if (!selectedMentee) {
      setError('Sila pilih usahawan terlebih dahulu.');
      setIsSubmitting(false);
      return;
    }

    if (!isMIA) {
      if (currentSession === 1) {
        if (!files.gw) {
          setError('Sila muat naik Gambar Carta GrowthWheel.');
          setIsSubmitting(false);
          return;
        }
        if (!files.profil) {
          setError('Sila muat naik Gambar Individu Usahawan.');
          setIsSubmitting(false);
          return;
        }
        if (files.sesi.length === 0) {
          setError('Sila muat naik sekurang-kurangnya satu Gambar Sesi Mentoring.');
          setIsSubmitting(false);
          return;
        }
        if (formState.sesi.platform === 'Face to Face' && !formState.sesi.lokasiF2F) {
          setError('Sila masukkan lokasi untuk sesi Face to Face.');
          setIsSubmitting(false);
          return;
        }
        if (formState.sesi.premisDilawat && (files.premis?.length || 0) < 1) {
          setError("Sila muat naik Gambar Premis kerana 'Premis dilawat' ditandakan.");
          setIsSubmitting(false);
          return;
        }
      } else {
        if (files.sesi.length === 0) {
          setError('Sila muat naik sekurang-kurangnya satu Gambar Sesi Mentoring.');
          setIsSubmitting(false);
          return;
        }
        if (formState.sesi.platform === 'Face to Face' && !formState.sesi.lokasiF2F) {
          setError('Sila masukkan lokasi untuk sesi Face to Face.');
          setIsSubmitting(false);
          return;
        }
        // --- Non-blocking reminder instead of blocking requirement for premis
        if (!previousData.premisDilawat && (files.premis?.length || 0) < 1) {
          showToast('Peringatan: Premis belum pernah dilawat. Pertimbangkan muat naik gambar premis pada sesi ini.');
        }
      }
    }

    if (isMIA && !formState.mia.alasan) {
      setError('Sila berikan alasan untuk status MIA.');
      setIsSubmitting(false);
      return;
    }

    // ============== UPWARD MOBILITY VALIDATION ==============
    // UM data is MANDATORY for ALL Bangkit sessions EXCEPT MIA submissions
    const umErrors = [];

    // Skip UM validation for MIA submissions
    if (!isMIA) {

    // Section 1: Engagement Status
    if (!formState.upwardMobility.UM_STATUS_PENGLIBATAN || formState.upwardMobility.UM_STATUS_PENGLIBATAN.trim() === '') {
      umErrors.push('Upward Mobility - Status Penglibatan Usahawan adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_STATUS || formState.upwardMobility.UM_STATUS.trim() === '') {
      umErrors.push('Upward Mobility - Upward Mobility Status adalah wajib diisi');
    }

    // Section 2: BIMB Channels (all 6 required)
    if (!formState.upwardMobility.UM_AKAUN_BIMB || formState.upwardMobility.UM_AKAUN_BIMB.trim() === '') {
      umErrors.push('Upward Mobility - Akaun Semasa BIMB adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_BIMB_BIZ || formState.upwardMobility.UM_BIMB_BIZ.trim() === '') {
      umErrors.push('Upward Mobility - BIMB Biz adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_AL_AWFAR || formState.upwardMobility.UM_AL_AWFAR.trim() === '') {
      umErrors.push('Upward Mobility - Al-Awfar adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_MERCHANT_TERMINAL || formState.upwardMobility.UM_MERCHANT_TERMINAL.trim() === '') {
      umErrors.push('Upward Mobility - Merchant Terminal adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_FASILITI_LAIN || formState.upwardMobility.UM_FASILITI_LAIN.trim() === '') {
      umErrors.push('Upward Mobility - Fasiliti Lain BIMB adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_MESINKIRA || formState.upwardMobility.UM_MESINKIRA.trim() === '') {
      umErrors.push('Upward Mobility - MesinKira adalah wajib diisi');
    }

    // Section 3: Financial Metrics (all ulasan fields required)
    if (!formState.upwardMobility.UM_ULASAN_PENDAPATAN || formState.upwardMobility.UM_ULASAN_PENDAPATAN.trim() === '') {
      umErrors.push('Upward Mobility - Ulasan Mentor untuk Pendapatan adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_ULASAN_PEKERJA || formState.upwardMobility.UM_ULASAN_PEKERJA.trim() === '') {
      umErrors.push('Upward Mobility - Ulasan Mentor untuk Bilangan Pekerja adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_ULASAN_ASET_BUKAN_TUNAI || formState.upwardMobility.UM_ULASAN_ASET_BUKAN_TUNAI.trim() === '') {
      umErrors.push('Upward Mobility - Ulasan Mentor untuk Aset Bukan Tunai adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_ULASAN_ASET_TUNAI || formState.upwardMobility.UM_ULASAN_ASET_TUNAI.trim() === '') {
      umErrors.push('Upward Mobility - Ulasan Mentor untuk Aset Tunai adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_ULASAN_SIMPANAN || formState.upwardMobility.UM_ULASAN_SIMPANAN.trim() === '') {
      umErrors.push('Upward Mobility - Ulasan Mentor untuk Simpanan adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_ULASAN_ZAKAT || formState.upwardMobility.UM_ULASAN_ZAKAT.trim() === '') {
      umErrors.push('Upward Mobility - Ulasan Mentor untuk Zakat adalah wajib diisi');
    }

    // Section 4: Digital & Section 5: Marketing (ulasan required)
    if (!formState.upwardMobility.UM_ULASAN_DIGITAL || formState.upwardMobility.UM_ULASAN_DIGITAL.trim() === '') {
      umErrors.push('Upward Mobility - Ulasan Mentor untuk Penggunaan Digital adalah wajib diisi');
    }
    if (!formState.upwardMobility.UM_ULASAN_MARKETING || formState.upwardMobility.UM_ULASAN_MARKETING.trim() === '') {
      umErrors.push('Upward Mobility - Ulasan Mentor untuk Jualan dan Pemasaran adalah wajib diisi');
    }

      // If there are UM validation errors, display them and stop submission
      if (umErrors.length > 0) {
        setError(`Sila lengkapkan medan Upward Mobility yang diperlukan:\n\n${umErrors.join('\n')}`);
        setIsSubmitting(false);
        return;
      }
    } // End of !isMIA check
    // ============== END UPWARD MOBILITY VALIDATION ==============

    setError('');
    setSuccess('');
    setSubmissionStage({ stage: 'preparing', message: 'Preparing submission...', detail: '' });

    try {
      const imageUrls = { growthwheel: '', profil: '', sesi: [], premis: [], mia: '' };
      const uploadPromises = [];
      const folderId = selectedMentee.Folder_ID;
      if (!folderId) throw new Error(`Folder ID tidak ditemui untuk usahawan: ${selectedMentee.Usahawan}`);

// REPLACE WITH THIS (uses smart upload for large images):
// Replace the entire uploadImage function and remove smartUploadImage/uploadImageDirect

// Smart compression with upfront calculations and progress callbacks
const compressImageForProxy = (base64String, targetSizeKB = 800, onProgress = null) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Phase 1: Calculate optimal settings upfront
      const calculateOptimalSettings = () => {
        if (onProgress) onProgress(1, 4, 'Calculating optimal settings...');

        const { width: origWidth, height: origHeight } = img;
        const originalSizeEstimateKB = (base64String.length * 0.75) / 1024;

        // Smart dimension calculation - single upfront calculation
        const maxDimension = 900; // Slightly larger starting point
        let width = origWidth;
        let height = origHeight;

        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        // Smart quality estimation based on compression ratio needed
        const compressionRatioNeeded = targetSizeKB / originalSizeEstimateKB;
        let startingQuality = Math.max(0.3, Math.min(0.8, compressionRatioNeeded * 1.2));

        console.log(`📊 Original: ${origWidth}x${origHeight} (~${originalSizeEstimateKB.toFixed(0)}KB)`);
        console.log(`📐 Target dimensions: ${Math.floor(width)}x${Math.floor(height)}`);
        console.log(`🎯 Target size: ${targetSizeKB}KB, starting quality: ${(startingQuality * 100).toFixed(0)}%`);

        return { width: Math.floor(width), height: Math.floor(height), startingQuality };
      };

      // Phase 2: Setup canvas once
      const settings = calculateOptimalSettings();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = settings.width;
      canvas.height = settings.height;
      ctx.drawImage(img, 0, 0, settings.width, settings.height);

      if (onProgress) onProgress(2, 4, `Resized to ${settings.width}x${settings.height}`);

      // Phase 3: Smart compression with non-blocking attempts
      const performSmartCompression = () => {
        let quality = settings.startingQuality;
        let attempts = 0;
        const maxAttempts = 5; // Reduced from 15 to 5

        const tryCompression = () => {
          if (attempts >= maxAttempts) {
            console.log('⚠️ Max attempts reached, using last result');
            const finalResult = canvas.toDataURL('image/jpeg', quality);
            if (onProgress) onProgress(4, 4, '✅ Compression completed');
            resolve(finalResult);
            return;
          }

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const estimatedSizeKB = (compressedDataUrl.length * 0.75) / 1024;

          attempts++;
          const progressMsg = `Attempt ${attempts}: ${estimatedSizeKB.toFixed(0)}KB @ ${(quality * 100).toFixed(0)}%`;
          console.log(`🔄 ${progressMsg}`);

          if (onProgress) onProgress(3, 4, progressMsg);

          if (estimatedSizeKB <= targetSizeKB) {
            console.log(`✅ Compressed to ${estimatedSizeKB.toFixed(0)}KB in ${attempts} attempts`);
            if (onProgress) onProgress(4, 4, `✅ Compressed to ${estimatedSizeKB.toFixed(0)}KB`);
            resolve(compressedDataUrl);
            return;
          }

          // Intelligent quality stepping - larger reductions initially
          if (attempts <= 2) {
            quality -= 0.15; // Aggressive initial reduction
          } else {
            quality -= 0.08; // Smaller fine-tuning
          }

          // Ensure minimum quality
          if (quality < 0.2) {
            quality = 0.2;
          }

          // Use requestAnimationFrame for non-blocking execution
          requestAnimationFrame(tryCompression);
        };

        // Start compression on next frame
        requestAnimationFrame(tryCompression);
      };

      // Phase 4: Start compression
      requestAnimationFrame(performSmartCompression);
    };

    img.src = base64String;
  });
};

const uploadImage = (file, fId, menteeName, sessionNumber) => new Promise(async (resolve, reject) => {
    try {
      const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.log(`📸 Processing ${file.name} (${originalSizeMB}MB)`);

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onloadend = async () => {
        try {
          // Progress callback for React state updates
          const onCompressionProgress = (current, total, message) => {
            setCompressionProgress({
              show: true,
              current,
              total,
              message,
              fileName: file.name
            });
          };

          // Always compress aggressively for proxy with progress
          console.log('🔄 Compressing image for proxy upload...');
          const compressedBase64 = await compressImageForProxy(reader.result, 800, onCompressionProgress); // Increased to 800KB target
          
          const imageData = {
            fileData: compressedBase64.split(',')[1], 
            fileName: file.name, 
            fileType: 'image/jpeg',
            folderId: fId, 
            menteeName, 
            sessionNumber
          };
          
          // Check final size
          const finalSizeKB = (compressedBase64.length * 0.75) / 1024;
          console.log(`📊 Final size: ${finalSizeKB.toFixed(0)}KB (original: ${originalSizeMB}MB)`);
          
          if (finalSizeKB > 800) {
            throw new Error(`Image still too large: ${finalSizeKB.toFixed(0)}KB. Please use a smaller image.`);
          }
          
          // Always use proxy - no direct connection disable 24012026
          //console.log('📤 Uploading via proxy...');
          //const response = await fetch('/api/upload-proxy', {
            //method: 'POST',
            //headers: {
              //'Content-Type': 'application/json',
              //'Accept': 'application/json'
            //},
            //body: JSON.stringify({ ...imageData, reportType: 'bangkit' }),
          //});
          console.log('📤 Uploading via upload-image...');
const formData = new FormData();
formData.append('file', file);
formData.append('folderId', fId);

const response = await fetch('/api/upload-image', {
  method: 'POST',
  body: formData,
});
reader.readAsDataURL(file);

await fetch('/api/upload-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'uploadImage',   // ✅ REQUIRED
    reportType: 'bangkit',
    ...imageData
  }),
});


          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Proxy error response:', errorText.substring(0, 200));
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          
          if (result.error) {
            throw new Error(`Server error: ${result.error}`);
          }
          
          console.log('✅ Upload successful');
          // Clear compression progress
          setCompressionProgress({ show: false, current: 0, total: 0, message: '', fileName: '' });
          resolve(result.url);
          
        } catch (error) {
          console.error('❌ Upload processing failed:', error);
          // Clear compression progress on error
          setCompressionProgress({ show: false, current: 0, total: 0, message: '', fileName: '' });
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read image file'));
      };
      
    } catch (error) {
      console.error('❌ Upload setup failed:', error);
      reject(error);
    }
});

      const menteeNameForUpload = selectedMentee.Usahawan;
      const sessionNumberForUpload = currentSession;

      if (isMIA) {
        if (files.mia) uploadPromises.push(uploadImage(files.mia, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => (imageUrls.mia = url)));
      } else if (currentSession === 1) {
        if (files.gw) uploadPromises.push(uploadImage(files.gw, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => (imageUrls.growthwheel = url)));
        if (files.profil) uploadPromises.push(uploadImage(files.profil, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => (imageUrls.profil = url)));
        files.sesi.forEach((file) => uploadPromises.push(uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => imageUrls.sesi.push(url))));
        if (formState.sesi.premisDilawat) {
          files.premis.forEach((file) => uploadPromises.push(uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => imageUrls.premis.push(url))));
        }
      } else {
        files.sesi.forEach((file) => uploadPromises.push(uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => imageUrls.sesi.push(url))));
        // Optional premis upload for sesi 2+
        if ((files.premis?.length || 0) > 0) {
          files.premis.forEach((file) => uploadPromises.push(uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => imageUrls.premis.push(url))));
        }
      }

      // Update stage: uploading images
      setSubmissionStage({
        stage: 'uploading',
        message: 'Uploading images to Google Drive...',
        detail: `Uploading ${uploadPromises.length} image${uploadPromises.length > 1 ? 's' : ''}`
      });

      await Promise.all(uploadPromises);

      // Clear compression progress immediately when uploads complete
      setCompressionProgress({ show: false, current: 0, total: 0, message: '', fileName: '' });

      // Clear saved draft BEFORE resetting
      try {
        const k = getDraftKey(selectedMentee?.Usahawan, currentSession, session?.user?.email);
        localStorage.removeItem(k);
      } catch {}

      // Transform inisiatif: merge keputusanCustom into keputusan if CUSTOM is selected
      const transformedInisiatif = (formState.inisiatif || []).map(item => {
        if (item.keputusan === 'CUSTOM' && item.keputusanCustom) {
          return {
            ...item,
            keputusan: item.keputusanCustom,
            keputusanCustom: undefined
          };
        }
        return item;
      });

      const reportData = {
        ...formState,
        inisiatif: transformedInisiatif,
        status: isMIA ? 'MIA' : 'Selesai',
        sesiLaporan: currentSession,
        usahawan: selectedMentee.Usahawan,
        namaSyarikat: selectedMentee.Nama_Syarikat,
        namaMentor: session.user.name,
        mentorEmail: session.user.email,
        imageUrls,
        premisDilawatChecked: !!formState.sesi?.premisDilawat,
        programType: 'bangkit', // Added programType
      };

      // UPWARD MOBILITY - Only include for non-MIA submissions
      if (!isMIA) {
        reportData.UPWARD_MOBILITY_JSON = JSON.stringify({
          UM_STATUS_PENGLIBATAN: formState.upwardMobility.UM_STATUS_PENGLIBATAN || '',
          UM_STATUS: formState.upwardMobility.UM_STATUS || '',
          UM_KRITERIA_IMPROVEMENT: formState.upwardMobility.UM_KRITERIA_IMPROVEMENT || '',
          UM_AKAUN_BIMB: formState.upwardMobility.UM_AKAUN_BIMB || '',
          UM_BIMB_BIZ: formState.upwardMobility.UM_BIMB_BIZ || '',
          UM_AL_AWFAR: formState.upwardMobility.UM_AL_AWFAR || '',
          UM_MERCHANT_TERMINAL: formState.upwardMobility.UM_MERCHANT_TERMINAL || '',
          UM_FASILITI_LAIN: formState.upwardMobility.UM_FASILITI_LAIN || '',
          UM_MESINKIRA: formState.upwardMobility.UM_MESINKIRA || '',
          UM_PENDAPATAN_SEMASA: formState.upwardMobility.UM_PENDAPATAN_SEMASA || '',
          UM_ULASAN_PENDAPATAN: formState.upwardMobility.UM_ULASAN_PENDAPATAN || '',
          UM_PEKERJA_SEMASA: formState.upwardMobility.UM_PEKERJA_SEMASA || '',
          UM_ULASAN_PEKERJA: formState.upwardMobility.UM_ULASAN_PEKERJA || '',
          UM_ASET_BUKAN_TUNAI_SEMASA: formState.upwardMobility.UM_ASET_BUKAN_TUNAI_SEMASA || '',
          UM_ULASAN_ASET_BUKAN_TUNAI: formState.upwardMobility.UM_ULASAN_ASET_BUKAN_TUNAI || '',
          UM_ASET_TUNAI_SEMASA: formState.upwardMobility.UM_ASET_TUNAI_SEMASA || '',
          UM_ULASAN_ASET_TUNAI: formState.upwardMobility.UM_ULASAN_ASET_TUNAI || '',
          UM_SIMPANAN_SEMASA: formState.upwardMobility.UM_SIMPANAN_SEMASA || '',
          UM_ULASAN_SIMPANAN: formState.upwardMobility.UM_ULASAN_SIMPANAN || '',
          UM_ZAKAT_SEMASA: formState.upwardMobility.UM_ZAKAT_SEMASA || '',
          UM_ULASAN_ZAKAT: formState.upwardMobility.UM_ULASAN_ZAKAT || '',
          UM_DIGITAL_SEMASA: Array.isArray(formState.upwardMobility.UM_DIGITAL_SEMASA)
            ? formState.upwardMobility.UM_DIGITAL_SEMASA.join(', ')
            : (formState.upwardMobility.UM_DIGITAL_SEMASA || ''),
          UM_ULASAN_DIGITAL: formState.upwardMobility.UM_ULASAN_DIGITAL || '',
          UM_MARKETING_SEMASA: Array.isArray(formState.upwardMobility.UM_MARKETING_SEMASA)
            ? formState.upwardMobility.UM_MARKETING_SEMASA.join(', ')
            : (formState.upwardMobility.UM_MARKETING_SEMASA || ''),
          UM_ULASAN_MARKETING: formState.upwardMobility.UM_ULASAN_MARKETING || '',
          UM_TARIKH_LAWATAN_PREMIS: formState.upwardMobility.UM_TARIKH_LAWATAN_PREMIS || '',
        });
      }

      // Update stage: saving to database
      setSubmissionStage({
        stage: 'saving',
        message: 'Saving report to Google Sheets...',
        detail: 'This may take up to 30 seconds'
      });

      // Add frontend timeout protection (25 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        const response = await fetch('/api/submitBangkit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Safe JSON parsing with fallback
        let result;
        const contentType = response.headers.get('content-type');

        try {
          if (contentType && contentType.includes('application/json')) {
            result = await response.json();
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

        if (!response.ok) {
          // Enhanced error message based on status code
          let userMessage = result.error;

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

        // Success path continues below...
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          throw new Error('⏱️ Request timeout - sila cuba lagi. Jika masalah berterusan, hubungi admin.');
        }
        throw fetchError;
      }

      // Update stage: complete
      setSubmissionStage({
        stage: 'complete',
        message: 'Report submitted successfully!',
        detail: ''
      });

      setSuccess('✅ Laporan Bangkit dan Upward Mobility berjaya dihantar! Borang sedang direset...');
      window.scrollTo(0, 0);
      // Reduced timeout and immediate feedback
      setTimeout(() => {
        resetForm();
        setSuccess('');
        setSubmissionStage({ stage: '', message: '', detail: '' });
      }, 1500); // Reduced from 3000ms to 1500ms
    } catch (err) {
      // Determine stage-specific error message
      let errorMessage = err.message;
      let errorDetail = '';

      if (submissionStage.stage === 'uploading') {
        errorMessage = `❌ Image upload failed: ${err.message}`;
        errorDetail = 'Check your internet connection and try again.';
      } else if (submissionStage.stage === 'saving') {
        errorMessage = `⚠️ ${err.message}`;
        errorDetail = '';
      }

      setSubmissionStage({
        stage: 'error',
        message: errorMessage,
        detail: errorDetail
      });

      setError(errorMessage);
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSesi1Form = () => {
    const focusAreaOptions = [...new Set(frameworkData.map((item) => item.Focus_Area))];
    return (
      <div className="space-y-6">
        <Section title="Maklumat Usahawan & Sesi">
          <div className="p-4 bg-gray-50 rounded-lg">
            <InfoCard companyName={selectedMentee.Nama_Syarikat} address={selectedMentee.Alamat} phone={selectedMentee.No_Tel} />
          </div>
          <div className="pt-4 mt-4 border-t space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField label="Jenis Bisnes" value={formState.tambahan.jenisBisnes} onChange={(e) => handleInputChange('tambahan', 'jenisBisnes', e.target.value)} required />
              <InputField label="Produk/Servis Utama" value={formState.tambahan.produkServis} onChange={(e) => handleInputChange('tambahan', 'produkServis', e.target.value)} required />
            </div>
            <InputField label="Pautan Media Sosial (Facebook/Instagram/TikTok)" value={formState.tambahan.pautanMediaSosial} onChange={(e) => handleInputChange('tambahan', 'pautanMediaSosial', e.target.value)} required />
          </div>
          <div className="pt-4 mt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField label="Tarikh Sesi" type="date" value={formState.sesi.date} onChange={(e) => handleInputChange('sesi', 'date', e.target.value)} required />
              <InputField label="Waktu Sesi Bermula" type="time" value={formState.sesi.time} onChange={(e) => handleInputChange('sesi', 'time', e.target.value)} required />
              <SelectField label="Mod Sesi / Platform" value={formState.sesi.platform} onChange={(e) => handleInputChange('sesi', 'platform', e.target.value)} required>
                <option>Face to Face</option>
                <option>Online</option>
              </SelectField>
            </div>
            {formState.sesi.platform === 'Face to Face' && (
              <div className="mt-4">
                <InputField label="Lokasi Sesi (Jika F2F)" value={formState.sesi.lokasiF2F} onChange={(e) => handleInputChange('sesi', 'lokasiF2F', e.target.value)} placeholder="Cth: Pejabat usahawan, ABC Cafe" required />
              </div>
            )}
          </div>
        </Section>

        {/* Lawatan Premis checkbox */}
        <Section title="Lawatan Premis">
          <div className="flex items-center gap-3">
            <input id="premisDilawat" type="checkbox" className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500" checked={!!formState.sesi.premisDilawat} onChange={(e) => handleInputChange('sesi', 'premisDilawat', e.target.checked)} />
            <label htmlFor="premisDilawat" className="font-medium text-gray-700">Premis dilawat semasa sesi ini</label>
          </div>
        </Section>


        <Section title="Prestasi Jualan">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-md mb-2">Jualan Tahun Sebelum</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="RM Setahun" type="number" value={formState.jualanTahunSebelum?.setahun || ''} onChange={(e) => handleInputChange('jualanTahunSebelum', 'setahun', e.target.value)} />
              <InputField label="RM Bulanan Minima" type="number" value={formState.jualanTahunSebelum?.bulananMin || ''} onChange={(e) => handleInputChange('jualanTahunSebelum', 'bulananMin', e.target.value)} />
              <InputField label="RM Bulanan Maksima" type="number" value={formState.jualanTahunSebelum?.bulananMaks || ''} onChange={(e) => handleInputChange('jualanTahunSebelum', 'bulananMaks', e.target.value)} />
            </div>
          </div>
          <div className="p-4 border rounded-lg mt-4">
            <h3 className="font-semibold text-md mb-2">Jualan Bulanan Terkini</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'].map((month, i) => (
                <InputField key={month} label={month} type="number" value={formState.jualanTerkini?.[i] || ''} onChange={(e) => { const newSales = [...formState.jualanTerkini]; newSales[i] = e.target.value; setFormState((p) => ({ ...p, jualanTerkini: newSales })); }} />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Status Perniagaan Keseluruhan" description="Pemerhatian Mentor/Coach berdasarkan panduan.">
          <TextArea
            label="Status Perniagaan Keseluruhan"
            rows={10}
            value={formState.pemerhatian || ''}
            onChange={(e) => setFormState((p) => ({ ...p, pemerhatian: e.target.value }))}
            required={true}
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

        <Section title="Keputusan Mentee - Inisiatif yang mahu diambil" description="Berdasarkan pemerhatian, pilih Fokus Area dan Keputusan yang perlu diambil.">
          {(formState.inisiatif || []).map((inisiatifItem, index) => {
            const keputusanOptions = inisiatifItem.focusArea ? frameworkData.filter((item) => item.Focus_Area === inisiatifItem.focusArea) : [];
            const cadangan = frameworkData.find((item) => item.Keputusan === inisiatifItem.keputusan);
            return (
              <div key={index} className="border p-4 rounded-lg bg-gray-50 space-y-4">
                <h4 className="font-bold text-gray-700">Inisiatif #{index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField label="Fokus Area" value={inisiatifItem.focusArea} onChange={(e) => handleInisiatifChange(index, 'focusArea', e.target.value)} required>
                    <option value="">-- Pilih Fokus Area --</option>
                    {[...new Set(frameworkData.map((item) => item.Focus_Area))].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </SelectField>
                  <div>
                    <SelectField label="Keputusan" value={inisiatifItem.keputusan} onChange={(e) => handleInisiatifChange(index, 'keputusan', e.target.value)} disabled={!inisiatifItem.focusArea} required>
                      <option value="">-- Pilih Keputusan --</option>
                      {keputusanOptions.map((opt) => (
                        <option key={opt.Keputusan} value={opt.Keputusan}>{opt.Keputusan}</option>
                      ))}
                      <option value="CUSTOM">Lain-lain (Custom)</option>
                    </SelectField>
                    {inisiatifItem.keputusan === 'CUSTOM' && (
                      <input
                        type="text"
                        className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Masukkan keputusan custom"
                        value={inisiatifItem.keputusanCustom || ''}
                        onChange={(e) => handleInisiatifChange(index, 'keputusanCustom', e.target.value)}
                        required
                      />
                    )}
                  </div>
                </div>
                {cadangan && (
                  <div className="bg-yellow-50 p-3 rounded-lg text-sm text-gray-800 border border-yellow-200">
                    <strong>Cadangan Tindakan:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {cadangan.Cadangan_Tindakan1 && <li>{cadangan.Cadangan_Tindakan1}</li>}
                      {cadangan.Cadangan_Tindakan2 && <li>{cadangan.Cadangan_Tindakan2}</li>}
                      {cadangan.Cadangan_Tindakan3 && <li>{cadangan.Cadangan_Tindakan3}</li>}
                    </ul>
                  </div>
                )}
                <TextArea label="Pelan Tindakan Terperinci" value={inisiatifItem.pelanTindakan} onChange={(e) => handleInisiatifChange(index, 'pelanTindakan', e.target.value)} rows={3} required />
              </div>
            );
          })}
          {(formState.inisiatif || []).length < 4 && (
            <button type="button" onClick={addInisiatif} className="text-sm bg-blue-100 text-blue-800 font-semibold py-1 px-3 rounded-md hover:bg-blue-200">+ Tambah Inisiatif</button>
          )}
        </Section>

        <Section title="Rumusan Keseluruhan dan Langkah Kehadapan">
          <TextArea
            label="Rumusan Keseluruhan dan Langkah Kehadapan"
            rows={6}
            value={formState.rumusan || ''}
            onChange={(e) => setFormState((p) => ({ ...p, rumusan: e.target.value }))}
            required={true}
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

        {/* ============== UPWARD MOBILITY SECTION (WAJIB) ============== */}
        <div className="bg-orange-50 p-6 border-2 border-orange-500 rounded-lg mt-6">
          <h2 className="text-2xl font-bold text-orange-800 mb-2 text-center">
            BAHAGIAN UPWARD MOBILITY (WAJIB)
          </h2>
          <p className="text-sm text-orange-700 text-center mb-6">
            ⚠️ Bahagian ini WAJIB diisi untuk SEMUA sesi Bangkit (1, 2, 3, 4)
          </p>

          <div className="space-y-6">
            {/* Section 1: Engagement Status */}
            <Section title="Bahagian 1: Status Penglibatan & Mobiliti">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Penglibatan Usahawan <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {['Active', 'Not Active (Contactable)', 'Not Involved (Uncontactable)'].map((status) => (
                    <label key={status} className="flex items-center p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                      <input
                        type="radio"
                        name="UM_STATUS_PENGLIBATAN"
                        value={status}
                        checked={formState.upwardMobility.UM_STATUS_PENGLIBATAN === status}
                        onChange={(e) => handleUMChange('UM_STATUS_PENGLIBATAN', e.target.value)}
                        className="mr-3"
                        required
                      />
                      <span className="font-medium">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upward Mobility Status <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'Grade 1 (G1)', label: 'Grade 1 (G1)' },
                    { value: 'Grade 2 (G2)', label: 'Grade 2 (G2)' },
                    { value: 'NIL', label: 'NIL' }
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                      <input
                        type="radio"
                        name="UM_STATUS"
                        value={opt.value}
                        checked={formState.upwardMobility.UM_STATUS === opt.value}
                        onChange={(e) => handleUMChange('UM_STATUS', e.target.value)}
                        className="mr-3"
                        required
                      />
                      <span className="font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <TextArea
                label="Jika G1/G2, nyatakan kriteria improvement"
                value={formState.upwardMobility.UM_KRITERIA_IMPROVEMENT}
                onChange={(e) => handleUMChange('UM_KRITERIA_IMPROVEMENT', e.target.value)}
                rows={3}
                placeholder="Contoh: Grade 2 - Credit score meningkat"
                required={formState.upwardMobility.UM_STATUS?.includes('Grade')}
              />
            </Section>

            {/* Section 2: BIMB Channels & Fintech */}
            <Section title="Bahagian 2: Penggunaan Saluran BIMB & Fintech">
              <div className="space-y-4">
                {/* Field 1: Akaun Semasa BIMB */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">1. Penggunaan Akaun Semasa BIMB (Current Account) <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Klik <strong>Yes</strong> - Jika usahawan menggunakan secara aktif untuk transaksi bisnes.<br/>
                    Klik <strong>No</strong> - Jika usahawan hanya menggunakan untuk membayar pembiayaan atau tidak aktif.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_AKAUN_BIMB"
                          value={val}
                          checked={formState.upwardMobility.UM_AKAUN_BIMB === val}
                          onChange={(e) => handleUMChange('UM_AKAUN_BIMB', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 2: BIMB Biz */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">2. Penggunaan BIMB Biz <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Aplikasi perbankan mudah alih yang membolehkan usahawan mengurus perniagaan harian mereka dengan cepat dan selamat.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_BIMB_BIZ"
                          value={val}
                          checked={formState.upwardMobility.UM_BIMB_BIZ === val}
                          onChange={(e) => handleUMChange('UM_BIMB_BIZ', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 3: Al-Awfar */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">3. Buka akaun Al-Awfar (Opened Al-Awfar Account) <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Klik <strong>Yes</strong> - Jika usahawan membuka akaun Al-Awfar.<br/>
                    Klik <strong>No</strong> - Jika usahawan tidak membuka akaun Al-Awfar.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_AL_AWFAR"
                          value={val}
                          checked={formState.upwardMobility.UM_AL_AWFAR === val}
                          onChange={(e) => handleUMChange('UM_AL_AWFAR', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 4: Merchant Terminal */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">4. Penggunaan BIMB Merchant Terminal / Pay2phone <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Aplikasi Bank Islam yang membenarkan usahawan menerima pembayaran tanpa sentuh kad kredit & kad debit melalui telefon bimbit android usahawan yang menggunakan Teknologi NFC.<br/>
                    Klik <strong>Yes</strong> - Jika usahawan ada menggunakan walaupun jarang-jarang.<br/>
                    Klik <strong>No</strong> - Jika usahawan tidak pernah menggunakan / tidak tersedia.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_MERCHANT_TERMINAL"
                          value={val}
                          checked={formState.upwardMobility.UM_MERCHANT_TERMINAL === val}
                          onChange={(e) => handleUMChange('UM_MERCHANT_TERMINAL', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 5: Fasiliti Lain */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">5. Lain-lain Fasiliti BIMB (Other BIMB Facilities) <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Fasiliti yang ditawarkan oleh BIMB untuk bisnes sahaja seperti kad kredit bisnes dan lain-lain.<br/>
                    Klik <strong>Yes</strong> - Jika ada menggunakan fasiliti BIMB yang lain untuk bisnes usahawan SAHAJA SELEPAS mendapat pembiayaan daripada BIMB (contoh kad kredit perniagaan dan lain-lain yang melibatkan BISNES SAHAJA, bukan peribadi).<br/>
                    Klik <strong>No</strong> - Jika tidak menggunakan mana-mana servis / fasiliti BIMB SELEPAS mendapat pembiayaan.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_FASILITI_LAIN"
                          value={val}
                          checked={formState.upwardMobility.UM_FASILITI_LAIN === val}
                          onChange={(e) => handleUMChange('UM_FASILITI_LAIN', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 6: Mesinkira */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">6. Melanggan aplikasi MesinKira (Subscribed Mesinkira Apps) <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Klik <strong>Yes</strong> - Jika ada melanggan aplikasi MesinKira walaupun tidak pernah atau jarang digunakan.<br/>
                    Klik <strong>No</strong> - Tidak pernah subscribe aplikasi MesinKira.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_MESINKIRA"
                          value={val}
                          checked={formState.upwardMobility.UM_MESINKIRA === val}
                          onChange={(e) => handleUMChange('UM_MESINKIRA', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Section 3: Financial Metrics */}
            <Section title="Bahagian 3: Situasi Kewangan">
              <div className="space-y-6">
                {[
                  { field: 'UM_PENDAPATAN_SEMASA', ulasan: 'UM_ULASAN_PENDAPATAN', label: 'Pendapatan Bulanan (RM)', placeholder: 'Cth: 8000' },
                  { field: 'UM_PEKERJA_SEMASA', ulasan: 'UM_ULASAN_PEKERJA', label: 'Bilangan Pekerja', placeholder: 'Cth: 2' },
                  { field: 'UM_ASET_BUKAN_TUNAI_SEMASA', ulasan: 'UM_ULASAN_ASET_BUKAN_TUNAI', label: 'Aset Bukan Tunai (RM)', placeholder: 'Cth: 15000' },
                  { field: 'UM_ASET_TUNAI_SEMASA', ulasan: 'UM_ULASAN_ASET_TUNAI', label: 'Aset Tunai (RM)', placeholder: 'Cth: 5000' },
                  { field: 'UM_SIMPANAN_SEMASA', ulasan: 'UM_ULASAN_SIMPANAN', label: 'Simpanan Bulanan (RM)', placeholder: 'Cth: 500' },
                  { field: 'UM_ZAKAT_SEMASA', ulasan: 'UM_ULASAN_ZAKAT', label: 'Zakat Tahunan (RM)', placeholder: 'Cth: 1000' }
                ].map((item) => (
                  <div key={item.field} className="border-l-4 border-orange-300 pl-4">
                    <InputField
                      label={`${item.label} *`}
                      type="number"
                      value={formState.upwardMobility[item.field]}
                      onChange={(e) => handleUMChange(item.field, e.target.value)}
                      placeholder={item.placeholder}
                      step="0.01"
                      required
                    />
                    <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <TextArea
                        label="Ulasan Mentor *"
                        value={formState.upwardMobility[item.ulasan]}
                        onChange={(e) => handleUMChange(item.ulasan, e.target.value)}
                        rows={2}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Section 4: Digitalization */}
            <Section title="Bahagian 4: Pendigitalan">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tahap Penggunaan Digital <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Pilih semua yang berkenaan</p>
                <div className="space-y-2">
                  {[
                    '1 - Data asas dan terhad',
                    '2 - Pengguna advance dan peranti khusus',
                    '3 - Transaksi kewangan mudah alih/e-wallet',
                    '4 - Laman web rasmi'
                  ].map((option) => (
                    <label key={option} className="flex items-start p-3 border border-gray-300 rounded-lg hover:bg-orange-50 cursor-pointer">
                      <input
                        type="checkbox"
                        value={option}
                        checked={formState.upwardMobility.UM_DIGITAL_SEMASA.includes(option)}
                        onChange={(e) => {
                          const current = formState.upwardMobility.UM_DIGITAL_SEMASA;
                          handleUMChange('UM_DIGITAL_SEMASA',
                            e.target.checked ? [...current, option] : current.filter(v => v !== option)
                          );
                        }}
                        className="mr-3 mt-1"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <TextArea
                  label="Ulasan Mentor - Digital *"
                  value={formState.upwardMobility.UM_ULASAN_DIGITAL}
                  onChange={(e) => handleUMChange('UM_ULASAN_DIGITAL', e.target.value)}
                  rows={3}
                  required
                />
              </div>
            </Section>

            {/* Section 5: Marketing */}
            <Section title="Bahagian 5: Jualan & Pemasaran">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jualan & Pemasaran Online Semasa <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Pilih semua yang berkenaan</p>
                <div className="space-y-2">
                  {[
                    'Jualan Bisnes secara Online (e-commerce)',
                    'Pemasaran secara Online dan Live (Ads, Live)',
                    'Perniagaan campuran (Online & Premis)',
                    'Premis / Kedai fizikal'
                  ].map((option) => (
                    <label key={option} className="flex items-start p-3 border border-gray-300 rounded-lg hover:bg-orange-50 cursor-pointer">
                      <input
                        type="checkbox"
                        value={option}
                        checked={formState.upwardMobility.UM_MARKETING_SEMASA.includes(option)}
                        onChange={(e) => {
                          const current = formState.upwardMobility.UM_MARKETING_SEMASA;
                          handleUMChange('UM_MARKETING_SEMASA',
                            e.target.checked ? [...current, option] : current.filter(v => v !== option)
                          );
                        }}
                        className="mr-3 mt-1"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <TextArea
                  label="Ulasan Mentor - Marketing *"
                  value={formState.upwardMobility.UM_ULASAN_MARKETING}
                  onChange={(e) => handleUMChange('UM_ULASAN_MARKETING', e.target.value)}
                  rows={3}
                  required
                />
              </div>
            </Section>

            {/* Section 6: Premises Visit (OPTIONAL) */}
            <Section title="Bahagian 6: Lawatan Premis (Pilihan)">
              <InputField
                label="Tarikh Lawatan ke Premis"
                type="date"
                value={formState.upwardMobility.UM_TARIKH_LAWATAN_PREMIS}
                onChange={(e) => handleUMChange('UM_TARIKH_LAWATAN_PREMIS', e.target.value)}
                placeholder="Kosongkan jika belum dilawat"
                required={false}
              />
              <p className="text-xs text-gray-500 mt-2">* Kosongkan field ini jika premis belum dilawat</p>
            </Section>
          </div>
        </div>

        <Section title="Muat Naik Gambar (Sesi 1)">
          <FileInput label="Gambar Carta GrowthWheel 360°" onChange={(e) => handleFileChange('gw', e.target.files)} required />
          <FileInput label="Satu (1) Gambar Individu Usahawan (Profil)" onChange={(e) => handleFileChange('profil', e.target.files)} required />
          <FileInput label="Dua (2) Gambar Sesi Mentoring" multiple onChange={(e) => handleFileChange('sesi', e.target.files, true)} required />
          {formState.sesi.premisDilawat && (
            <div>
              <FileInput label="Gambar Lawatan Premis *" multiple onChange={(e) => handleFileChange('premis', e.target.files, true)} required />
              <p className="mt-1 text-sm text-gray-600 italic">
                Gambar bahagian depan premis bisnes mentee, Gambar-gambar ruang dalam bisnes mentee, Gambar-gambar aset yang ada (terutama yang dibeli menggunakan geran BIMB), selfie depan premise
              </p>
            </div>
          )}
        </Section>
      </div>
    );
  };

  const renderSesi2PlusForm = () => {
    const focusAreaOptions = [...new Set(frameworkData.map((item) => item.Focus_Area))];
    return (
      <div className="space-y-6">
        <Section title={`Maklumat Sesi ${currentSession}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField label="Tarikh Sesi" type="date" value={formState.sesi.date} onChange={(e) => handleInputChange('sesi', 'date', e.target.value)} required />
            <InputField label="Waktu Sesi Bermula" type="time" value={formState.sesi.time} onChange={(e) => handleInputChange('sesi', 'time', e.target.value)} required />
            <SelectField label="Mod Sesi / Platform" value={formState.sesi.platform} onChange={(e) => handleInputChange('sesi', 'platform', e.target.value)} required>
              <option>Face to Face</option>
              <option>Online</option>
            </SelectField>
          </div>
          {formState.sesi.platform === 'Face to Face' && (
            <div className="mt-4">
              <InputField label="Lokasi Sesi (Jika F2F)" value={formState.sesi.lokasiF2F} onChange={(e) => handleInputChange('sesi', 'lokasiF2F', e.target.value)} placeholder="Cth: Pejabat usahawan, ABC Cafe" required />
            </div>
          )}
        </Section>

        {previousData.inisiatif.length > 0 && (
          <Section title="Kemaskini Inisiatif Sesi Lepas">
            <div className="space-y-4">
              {previousData.inisiatif.map((item, index) => (
                <div key={index} className="p-4 bg-gray-50 border rounded-lg">
                  <div className="text-sm mb-2">
                    <p><strong>Fokus Area:</strong> {item.focusArea}</p>
                    <p><strong>Keputusan:</strong> {item.keputusan}</p>
                    <p className="text-gray-600"><strong>Pelan Tindakan Asal:</strong> {item.pelanTindakan}</p>
                  </div>
                  <TextArea label={`Kemaskini Kemajuan #${index + 1}`} value={formState.kemaskiniInisiatif[index] || ''} onChange={(e) => handleKemaskiniChange(index, e.target.value)} rows={3} required />
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Jualan Bulanan Terkini">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'].map((month, i) => (
              <InputField key={month} label={month} type="number" value={formState.jualanTerkini?.[i] || ''} onChange={(e) => { const newSales = [...formState.jualanTerkini]; newSales[i] = e.target.value; setFormState((p) => ({ ...p, jualanTerkini: newSales })); }} />
            ))}
          </div>
        </Section>

        <Section title="Keputusan Mentee - Inisiatif yang mahu diambil Sesi Ini">
          {(formState.inisiatif || []).map((inisiatifItem, index) => {
            const keputusanOptions = inisiatifItem.focusArea ? frameworkData.filter((item) => item.Focus_Area === inisiatifItem.focusArea) : [];
            const cadangan = frameworkData.find((item) => item.Keputusan === inisiatifItem.keputusan);
            return (
              <div key={index} className="border p-4 rounded-lg bg-gray-50 space-y-4">
                <h4 className="font-bold text-gray-700">Inisiatif Baru #{index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField label="Fokus Area" value={inisiatifItem.focusArea} onChange={(e) => handleInisiatifChange(index, 'focusArea', e.target.value)} required>
                    <option value="">-- Pilih Fokus Area --</option>
                    {focusAreaOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                  </SelectField>
                  <div>
                    <SelectField label="Keputusan" value={inisiatifItem.keputusan} onChange={(e) => handleInisiatifChange(index, 'keputusan', e.target.value)} disabled={!inisiatifItem.focusArea} required>
                      <option value="">-- Pilih Keputusan --</option>
                      {keputusanOptions.map((opt) => (<option key={opt.Keputusan} value={opt.Keputusan}>{opt.Keputusan}</option>))}
                      <option value="CUSTOM">Lain-lain (Custom)</option>
                    </SelectField>
                    {inisiatifItem.keputusan === 'CUSTOM' && (
                      <input
                        type="text"
                        className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Masukkan keputusan custom"
                        value={inisiatifItem.keputusanCustom || ''}
                        onChange={(e) => handleInisiatifChange(index, 'keputusanCustom', e.target.value)}
                        required
                      />
                    )}
                  </div>
                </div>
                {cadangan && (
                  <div className="bg-yellow-50 p-3 rounded-lg text-sm text-gray-800 border border-yellow-200">
                    <strong>Cadangan Tindakan:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {cadangan.Cadangan_Tindakan1 && <li>{cadangan.Cadangan_Tindakan1}</li>}
                      {cadangan.Cadangan_Tindakan2 && <li>{cadangan.Cadangan_Tindakan2}</li>}
                      {cadangan.Cadangan_Tindakan3 && <li>{cadangan.Cadangan_Tindakan3}</li>}
                    </ul>
                  </div>
                )}
                <TextArea label="Pelan Tindakan Terperinci" value={inisiatifItem.pelanTindakan} onChange={(e) => handleInisiatifChange(index, 'pelanTindakan', e.target.value)} rows={3} required />
              </div>
            );
          })}
          {(formState.inisiatif || []).length < 4 && (
            <button type="button" onClick={addInisiatif} className="text-sm bg-blue-100 text-blue-800 font-semibold py-1 px-3 rounded-md hover:bg-blue-200">+ Tambah Inisiatif</button>
          )}
        </Section>

        <Section title="Rumusan Sesi">
          <TextArea
            label="Rumusan Sesi"
            rows={6}
            value={formState.rumusan || ''}
            onChange={(e) => setFormState((p) => ({ ...p, rumusan: e.target.value }))}
            required={true}
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

        {/* ============== UPWARD MOBILITY SECTION (WAJIB) ============== */}
        <div className="bg-orange-50 p-6 border-2 border-orange-500 rounded-lg mt-6">
          <h2 className="text-2xl font-bold text-orange-800 mb-2 text-center">
            BAHAGIAN UPWARD MOBILITY (WAJIB)
          </h2>
          <p className="text-sm text-orange-700 text-center mb-6">
            ⚠️ Bahagian ini WAJIB diisi untuk SEMUA sesi Bangkit (1, 2, 3, 4)
          </p>

          <div className="space-y-6">
            {/* Section 1: Engagement Status */}
            <Section title="Bahagian 1: Status Penglibatan & Mobiliti">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Penglibatan Usahawan <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {['Active', 'Not Active (Contactable)', 'Not Involved (Uncontactable)'].map((status) => (
                    <label key={status} className="flex items-center p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                      <input
                        type="radio"
                        name="UM_STATUS_PENGLIBATAN"
                        value={status}
                        checked={formState.upwardMobility.UM_STATUS_PENGLIBATAN === status}
                        onChange={(e) => handleUMChange('UM_STATUS_PENGLIBATAN', e.target.value)}
                        className="mr-3"
                        required
                      />
                      <span className="font-medium">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upward Mobility Status <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'Grade 1 (G1)', label: 'Grade 1 (G1)' },
                    { value: 'Grade 2 (G2)', label: 'Grade 2 (G2)' },
                    { value: 'NIL', label: 'NIL' }
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                      <input
                        type="radio"
                        name="UM_STATUS"
                        value={opt.value}
                        checked={formState.upwardMobility.UM_STATUS === opt.value}
                        onChange={(e) => handleUMChange('UM_STATUS', e.target.value)}
                        className="mr-3"
                        required
                      />
                      <span className="font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <TextArea
                label="Jika G1/G2, nyatakan kriteria improvement"
                value={formState.upwardMobility.UM_KRITERIA_IMPROVEMENT}
                onChange={(e) => handleUMChange('UM_KRITERIA_IMPROVEMENT', e.target.value)}
                rows={3}
                placeholder="Contoh: Grade 2 - Credit score meningkat"
                required={formState.upwardMobility.UM_STATUS?.includes('Grade')}
              />
            </Section>

            {/* Section 2: BIMB Channels & Fintech */}
            <Section title="Bahagian 2: Penggunaan Saluran BIMB & Fintech">
              <div className="space-y-4">
                {/* Field 1: Akaun Semasa BIMB */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">1. Penggunaan Akaun Semasa BIMB (Current Account) <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Klik <strong>Yes</strong> - Jika usahawan menggunakan secara aktif untuk transaksi bisnes.<br/>
                    Klik <strong>No</strong> - Jika usahawan hanya menggunakan untuk membayar pembiayaan atau tidak aktif.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_AKAUN_BIMB"
                          value={val}
                          checked={formState.upwardMobility.UM_AKAUN_BIMB === val}
                          onChange={(e) => handleUMChange('UM_AKAUN_BIMB', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 2: BIMB Biz */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">2. Penggunaan BIMB Biz <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Aplikasi perbankan mudah alih yang membolehkan usahawan mengurus perniagaan harian mereka dengan cepat dan selamat.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_BIMB_BIZ"
                          value={val}
                          checked={formState.upwardMobility.UM_BIMB_BIZ === val}
                          onChange={(e) => handleUMChange('UM_BIMB_BIZ', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 3: Al-Awfar */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">3. Buka akaun Al-Awfar (Opened Al-Awfar Account) <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Klik <strong>Yes</strong> - Jika usahawan membuka akaun Al-Awfar.<br/>
                    Klik <strong>No</strong> - Jika usahawan tidak membuka akaun Al-Awfar.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_AL_AWFAR"
                          value={val}
                          checked={formState.upwardMobility.UM_AL_AWFAR === val}
                          onChange={(e) => handleUMChange('UM_AL_AWFAR', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 4: Merchant Terminal */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">4. Penggunaan BIMB Merchant Terminal / Pay2phone <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Aplikasi Bank Islam yang membenarkan usahawan menerima pembayaran tanpa sentuh kad kredit & kad debit melalui telefon bimbit android usahawan yang menggunakan Teknologi NFC.<br/>
                    Klik <strong>Yes</strong> - Jika usahawan ada menggunakan walaupun jarang-jarang.<br/>
                    Klik <strong>No</strong> - Jika usahawan tidak pernah menggunakan / tidak tersedia.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_MERCHANT_TERMINAL"
                          value={val}
                          checked={formState.upwardMobility.UM_MERCHANT_TERMINAL === val}
                          onChange={(e) => handleUMChange('UM_MERCHANT_TERMINAL', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 5: Fasiliti Lain */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">5. Lain-lain Fasiliti BIMB (Other BIMB Facilities) <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Fasiliti yang ditawarkan oleh BIMB untuk bisnes sahaja seperti kad kredit bisnes dan lain-lain.<br/>
                    Klik <strong>Yes</strong> - Jika ada menggunakan fasiliti BIMB yang lain untuk bisnes usahawan SAHAJA SELEPAS mendapat pembiayaan daripada BIMB (contoh kad kredit perniagaan dan lain-lain yang melibatkan BISNES SAHAJA, bukan peribadi).<br/>
                    Klik <strong>No</strong> - Jika tidak menggunakan mana-mana servis / fasiliti BIMB SELEPAS mendapat pembiayaan.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_FASILITI_LAIN"
                          value={val}
                          checked={formState.upwardMobility.UM_FASILITI_LAIN === val}
                          onChange={(e) => handleUMChange('UM_FASILITI_LAIN', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Field 6: Mesinkira */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-2">6. Melanggan aplikasi MesinKira (Subscribed Mesinkira Apps) <span className="text-red-500">*</span></div>
                  <p className="text-sm text-gray-600 mb-3 italic">
                    Klik <strong>Yes</strong> - Jika ada melanggan aplikasi MesinKira walaupun tidak pernah atau jarang digunakan.<br/>
                    Klik <strong>No</strong> - Tidak pernah subscribe aplikasi MesinKira.
                  </p>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((val) => (
                      <label key={val} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="UM_MESINKIRA"
                          value={val}
                          checked={formState.upwardMobility.UM_MESINKIRA === val}
                          onChange={(e) => handleUMChange('UM_MESINKIRA', e.target.value)}
                          className="mr-2"
                          required
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Section 3: Financial Metrics */}
            <Section title="Bahagian 3: Situasi Kewangan">
              <div className="space-y-6">
                {[
                  { field: 'UM_PENDAPATAN_SEMASA', ulasan: 'UM_ULASAN_PENDAPATAN', label: 'Pendapatan Bulanan (RM)', placeholder: 'Cth: 8000' },
                  { field: 'UM_PEKERJA_SEMASA', ulasan: 'UM_ULASAN_PEKERJA', label: 'Bilangan Pekerja', placeholder: 'Cth: 2' },
                  { field: 'UM_ASET_BUKAN_TUNAI_SEMASA', ulasan: 'UM_ULASAN_ASET_BUKAN_TUNAI', label: 'Aset Bukan Tunai (RM)', placeholder: 'Cth: 15000' },
                  { field: 'UM_ASET_TUNAI_SEMASA', ulasan: 'UM_ULASAN_ASET_TUNAI', label: 'Aset Tunai (RM)', placeholder: 'Cth: 5000' },
                  { field: 'UM_SIMPANAN_SEMASA', ulasan: 'UM_ULASAN_SIMPANAN', label: 'Simpanan Bulanan (RM)', placeholder: 'Cth: 500' },
                  { field: 'UM_ZAKAT_SEMASA', ulasan: 'UM_ULASAN_ZAKAT', label: 'Zakat Tahunan (RM)', placeholder: 'Cth: 1000' }
                ].map((item) => (
                  <div key={item.field} className="border-l-4 border-orange-300 pl-4">
                    <InputField
                      label={`${item.label} *`}
                      type="number"
                      value={formState.upwardMobility[item.field]}
                      onChange={(e) => handleUMChange(item.field, e.target.value)}
                      placeholder={item.placeholder}
                      step="0.01"
                      required
                    />
                    <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <TextArea
                        label="Ulasan Mentor *"
                        value={formState.upwardMobility[item.ulasan]}
                        onChange={(e) => handleUMChange(item.ulasan, e.target.value)}
                        rows={2}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Section 4: Digitalization */}
            <Section title="Bahagian 4: Pendigitalan">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tahap Penggunaan Digital <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Pilih semua yang berkenaan</p>
                <div className="space-y-2">
                  {[
                    '1 - Data asas dan terhad',
                    '2 - Pengguna advance dan peranti khusus',
                    '3 - Transaksi kewangan mudah alih/e-wallet',
                    '4 - Laman web rasmi'
                  ].map((option) => (
                    <label key={option} className="flex items-start p-3 border border-gray-300 rounded-lg hover:bg-orange-50 cursor-pointer">
                      <input
                        type="checkbox"
                        value={option}
                        checked={formState.upwardMobility.UM_DIGITAL_SEMASA.includes(option)}
                        onChange={(e) => {
                          const current = formState.upwardMobility.UM_DIGITAL_SEMASA;
                          handleUMChange('UM_DIGITAL_SEMASA',
                            e.target.checked ? [...current, option] : current.filter(v => v !== option)
                          );
                        }}
                        className="mr-3 mt-1"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <TextArea
                  label="Ulasan Mentor - Digital *"
                  value={formState.upwardMobility.UM_ULASAN_DIGITAL}
                  onChange={(e) => handleUMChange('UM_ULASAN_DIGITAL', e.target.value)}
                  rows={3}
                  required
                />
              </div>
            </Section>

            {/* Section 5: Marketing */}
            <Section title="Bahagian 5: Jualan & Pemasaran">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jualan & Pemasaran Online Semasa <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Pilih semua yang berkenaan</p>
                <div className="space-y-2">
                  {[
                    'Jualan Bisnes secara Online (e-commerce)',
                    'Pemasaran secara Online dan Live (Ads, Live)',
                    'Perniagaan campuran (Online & Premis)',
                    'Premis / Kedai fizikal'
                  ].map((option) => (
                    <label key={option} className="flex items-start p-3 border border-gray-300 rounded-lg hover:bg-orange-50 cursor-pointer">
                      <input
                        type="checkbox"
                        value={option}
                        checked={formState.upwardMobility.UM_MARKETING_SEMASA.includes(option)}
                        onChange={(e) => {
                          const current = formState.upwardMobility.UM_MARKETING_SEMASA;
                          handleUMChange('UM_MARKETING_SEMASA',
                            e.target.checked ? [...current, option] : current.filter(v => v !== option)
                          );
                        }}
                        className="mr-3 mt-1"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <TextArea
                  label="Ulasan Mentor - Marketing *"
                  value={formState.upwardMobility.UM_ULASAN_MARKETING}
                  onChange={(e) => handleUMChange('UM_ULASAN_MARKETING', e.target.value)}
                  rows={3}
                  required
                />
              </div>
            </Section>

            {/* Section 6: Premises Visit (OPTIONAL) */}
            <Section title="Bahagian 6: Lawatan Premis (Pilihan)">
              <InputField
                label="Tarikh Lawatan ke Premis"
                type="date"
                value={formState.upwardMobility.UM_TARIKH_LAWATAN_PREMIS}
                onChange={(e) => handleUMChange('UM_TARIKH_LAWATAN_PREMIS', e.target.value)}
                placeholder="Kosongkan jika belum dilawat"
                required={false}
              />
              <p className="text-xs text-gray-500 mt-2">* Kosongkan field ini jika premis belum dilawat</p>
            </Section>
          </div>
        </div>

        {!previousData.premisDilawat && (
          <Section title="Status Lawatan Premis">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-gray-800">Premis belum dilawat semasa sesi-sesi terdahulu. Sila lawat dan muat naik gambar premis dalam sesi ini (tidak wajib).</p>
            </div>
          </Section>
        )}

        <Section title={`Muat Naik Gambar (Sesi ${currentSession})`}>
          <FileInput label="Gambar Sesi Mentoring" multiple onChange={(e) => handleFileChange('sesi', e.target.files, true)} required />
          {!previousData.premisDilawat && (
            <div>
              <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                Premis belum pernah dilawat. Disarankan muat naik gambar premis pada sesi ini (tidak wajib).
              </div>
              <FileInput
                label="Gambar Lawatan Premis (disyorkan – belum dilawat)"
                multiple
                onChange={(e) => handleFileChange('premis', e.target.files, true)}
              />
              <p className="mt-1 text-sm text-gray-600 italic">
                Gambar bahagian depan premis bisnes mentee, Gambar-gambar ruang dalam bisnes mentee, Gambar-gambar aset yang ada (terutama yang dibeli menggunakan geran BIMB), selfie depan premise
              </p>
            </div>
          )}
        </Section>
      </div>
    );
  };

  const renderMIAForm = () => (
    <Section title={`Laporan Status MIA - Sesi #${currentSession}`}>
      <TextArea label="Alasan / Sebab Usahawan MIA" value={formState.mia.alasan} onChange={(e) => handleInputChange('mia', 'alasan', e.target.value)} placeholder="Cth: Telah dihubungi 3 kali melalui WhatsApp pada 01/08/2025, tiada jawapan." required />
      <FileInput label="Muat Naik Bukti (Cth: Screenshot Perbualan)" onChange={(e) => handleFileChange('mia', e.target.files)} />
    </Section>
  );

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <header className="text-center bg-white p-6 rounded-lg shadow-sm relative">
          <img src="/logo1.png" alt="iTEKAD Logos" className="mx-auto h-20 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">Laporan Sesi Mentor</h1>
          <p className="text-gray-500 mt-1">Sila lengkapkan borang berdasarkan sesi semasa.</p>

          {/* Non-blocking toast */}
          {toast.show && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 bg-yellow-100 border border-yellow-300 text-yellow-900 px-4 py-2 rounded shadow text-sm">
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
                <SelectField id="mentor-selector" label="Pilih Mentor (Admin)" onChange={(e) => handleAdminMentorChange(e.target.value)} required>
                  <option value="">-- Sila Pilih Mentor --</option>
                  {uniqueMentors.map((mentor) => (
                    <option key={mentor} value={mentor}>{mentor}</option>
                  ))}
                </SelectField>
              ) : (
                <InputField label="Nama Mentor" value={session?.user?.name || ''} disabled />
              )}
              <SelectField id="mentee-selector" label="Pilih Usahawan (Mentee)" onChange={(e) => handleMenteeChange(e.target.value)} required disabled={isAdmin && !selectedAdminMentor}>
                <option value="">-- Sila Pilih Usahawan --</option>
                {filteredMentees.map((mentee) => (
                  <option key={mentee.Usahawan} value={mentee.Usahawan}>{mentee.Usahawan}</option>
                ))}
              </SelectField>
            </div>
            {selectedMentee && (
              <div className="text-center mt-6">
                <span className="text-lg font-bold text-white bg-blue-600 px-4 py-2 rounded-full">Sesi #{currentSession}</span>
              </div>
            )}
          </Section>

          {selectedMentee && menteeStatus === 'MIA' ? (
            <Section title="Status Usahawan">
              <p className="text-center font-semibold text-red-600">Usahawan ini telah ditandakan sebagai MIA (Missing In Action) dan tidak boleh diisi borang lagi.</p>
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
                  renderMIAForm()
                ) : currentSession === 1 ? (
                  renderSesi1Form()
                ) : (
                  renderSesi2PlusForm()
                )}
              </>
            )
          )}

          {selectedMentee && menteeStatus !== 'MIA' && (
            <div className="mt-6 pt-6 border-t">
              {/* Compression Progress Indicator - Near Submit Button */}
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
                <div className={`border rounded-lg p-4 mb-4 ${
                  submissionStage.stage === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    {submissionStage.stage !== 'error' && (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    )}
                    {submissionStage.stage === 'error' && (
                      <div className="text-red-600 text-2xl">⚠️</div>
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        submissionStage.stage === 'error' ? 'text-red-900' : 'text-blue-900'
                      }`}>
                        {submissionStage.message}
                      </p>
                      {submissionStage.detail && (
                        <p className={`text-xs mt-1 ${
                          submissionStage.stage === 'error' ? 'text-red-700' : 'text-blue-700'
                        }`}>
                          {submissionStage.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center">
                <button type="submit" disabled={isSubmitting || compressionProgress.show} className="w-full md:w-auto bg-green-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                  {compressionProgress.show ? '🔄 Compressing Images...' : isSubmitting ? '📤 Menghantar...' : 'Hantar Laporan Sesi ' + currentSession}
                </button>
                {saveStatus && <div className="mt-2 text-xs text-gray-500">{saveStatus}</div>}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}