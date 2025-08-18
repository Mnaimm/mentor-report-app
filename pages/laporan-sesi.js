import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

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
const TextArea = ({ label, value, onChange, placeholder, rows = 4, required = true }) => (
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
    inisiatif: [{ focusArea: '', keputusan: '', pelanTindakan: '' }],
    kemaskiniInisiatif: [],
    teknologi: [{ sistem: '', tujuan: '' }],
    jualanTahunSebelum: { tahun: new Date().getFullYear() - 1, setahun: '', bulananMin: '', bulananMaks: '' },
    jualanTerkini: Array(12).fill(''),
    pemerhatian: `Panduan:

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
- Peningkatan skil/pengetahuan`,
    rumusan: `Nota: 
Pastikan peserta pulang dengan Keputusan dan Tindakan yang perlu diusahakan, siapa dan bila. (Kongsikan/pastika usahawan juga jelas)
Apakah ada homework untuk peserta.
Sebaiknya, tetapkan masa pertemuan sesi akan datang, dan mod perbincangan.
Apakah bantuan, latihan yang mahu dicadangkan kepada HQ untuk membantu usahawan.
Apakah mentor ada bahan tambahan yang dapat membantu usahawan.
Apakah mentor perlukan bahan tambahan/banuan dari mentor mentor lain atau HQ.
Rumus poin-poin penting yang perlu diberi perhatian atau penekanan baik isu berkaitan bisnes mahupun tingkahlaku atau komitmen peserta.`,
    rumusanSesi2Plus: '',
    refleksi: { perasaan: '', skor: '', alasan: '', eliminate: '', raise: '', reduce: '', create: '' },
    sesi: { date: new Date().toISOString().split('T')[0], time: '', platform: 'Face to Face', lokasiF2F: '', premisDilawat: false },
    tambahan: { jenisBisnes: '', produkServis: '', pautanMediaSosial: '' },
    mia: { alasan: '' },
  };
  const [formState, setFormState] = useState(initialFormState);
  const [files, setFiles] = useState({ gw: null, profil: null, sesi: [], premis: [], mia: null });

  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // --- Autosave (local only) ---
  const getDraftKey = (menteeName, sessionNo, mentorEmail) =>
    `laporanSesi:draft:v1:${mentorEmail || 'unknown'}:${menteeName || 'none'}:s${sessionNo}`;
  const [saveStatus, setSaveStatus] = useState('');
  const [autosaveArmed, setAutosaveArmed] = useState(false);

  const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(session?.user?.email);

  const resetForm = () => {
    // clear current draft (safe if none)
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
            fetch('/api/mapping?programType=bangkit'), // <-- CHANGED HERE
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
    const payload = { ...formState }; // form fields only

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
    setAutosaveArmed(false); // disarm until new mentee selected
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
      const res = await fetch(`/api/menteeData?name=${encodeURIComponent(menteeName)}`);
      const data = await res.json();
      if (res.ok) {
        setCurrentSession(data.lastSession + 1);
        setMenteeStatus(data.status || '');
        const prevInisiatif = data.previousInisiatif || [];
        setPreviousData({
          sales: data.previousSales || [],
          inisiatif: prevInisiatif,
          premisDilawat: !!data.previousPremisDilawat,
        });
        setFormState((prev) => ({
          ...prev,
          jualanTerkini: data.previousSales || Array(12).fill(''),
          kemaskiniInisiatif: Array(prevInisiatif.length).fill(''),
        }));

        // --- Restore draft (if any) for this mentor/mentee/session
        try {
          const draftKey = getDraftKey(menteeName, data.lastSession + 1, session?.user?.email);
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            setFormState((prev) => ({ ...prev, ...parsed }));
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
  const addDynamicListItem = (listName, newItem) =>
    setFormState((p) => ({ ...p, [listName]: [...(p[listName] || []), newItem] }));
  const handleInisiatifChange = (index, field, value) =>
    setFormState((p) => {
      const l = [...(p.inisiatif || [])];
      const u = { ...l[index], [field]: value };
      if (field === 'focusArea') u.keputusan = '';
      l[index] = u;
      return { ...p, inisiatif: l };
    });
  const addInisiatif = () => {
    if ((formState.inisiatif || []).length < 4)
      addDynamicListItem('inisiatif', { focusArea: '', keputusan: '', pelanTindakan: '' });
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
    if (!selectedMentee) {
      setError('Sila pilih usahawan terlebih dahulu.');
      return;
    }

    if (!isMIA) {
      if (currentSession === 1) {
        if (!files.gw) { setError('Sila muat naik Gambar Carta GrowthWheel.'); return; }
        if (!files.profil) { setError('Sila muat naik Gambar Individu Usahawan.'); return; }
        if (files.sesi.length === 0) { setError('Sila muat naik sekurang-kurangnya satu Gambar Sesi Mentoring.'); return; }
        if (formState.sesi.platform === 'Face to Face' && !formState.sesi.lokasiF2F) { setError('Sila masukkan lokasi untuk sesi Face to Face.'); return; }
        if (formState.sesi.premisDilawat && (files.premis?.length || 0) < 1) { setError("Sila muat naik Gambar Premis kerana 'Premis dilawat' ditandakan."); return; }
      } else {
        if (files.sesi.length === 0) { setError('Sila muat naik sekurang-kurangnya satu Gambar Sesi Mentoring.'); return; }
        if (formState.sesi.platform === 'Face to Face' && !formState.sesi.lokasiF2F) { setError('Sila masukkan lokasi untuk sesi Face to Face.'); return; }
        if (!previousData.premisDilawat && (files.premis?.length || 0) < 1) { setError('Sila muat naik Gambar Premis (wajib kerana belum dilawat).'); return; }
      }
    }

    if (isMIA && !formState.mia.alasan) { setError('Sila berikan alasan untuk status MIA.'); return; }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const imageUrls = { growthwheel: '', profil: '', sesi: [], premis: [], mia: '' };
      const uploadPromises = [];
      const folderId = selectedMentee.Folder_ID;
      if (!folderId) throw new Error(`Folder ID tidak ditemui untuk usahawan: ${selectedMentee.Usahawan}`);

      const uploadImage = (file, fId, menteeName, sessionNumber) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
     // Call our proxy API instead of Apps Script directly
    fetch('/api/upload-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileData: reader.result.split(',')[1],
        fileName: file.name,
        fileType: file.type,
        folderId: fId,
        menteeName,
        sessionNumber
      })
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
        if (!previousData.premisDilawat && (files.premis?.length || 0) > 0) {
          files.premis.forEach((file) => uploadPromises.push(uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload).then((url) => imageUrls.premis.push(url))));
        }
      }

      await Promise.all(uploadPromises);

      // Clear saved draft (for this mentee/session) BEFORE resetting
      try {
        const k = getDraftKey(selectedMentee?.Usahawan, currentSession, session?.user?.email);
        localStorage.removeItem(k);
      } catch {}

      // Build payload to send
      const reportData = {
        ...formState,
        status: isMIA ? 'MIA' : 'Selesai',
        sesiLaporan: currentSession,
        usahawan: selectedMentee.Usahawan,
        namaSyarikat: selectedMentee.Nama_Syarikat,
        namaMentor: session.user.name,
        mentorEmail: session.user.email,
        imageUrls,
        premisDilawatChecked: !!formState.sesi?.premisDilawat, // drives BW tick in sheet
      };

      const response = await fetch('/api/submitReport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menghantar laporan.');

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

        <Section title="Teknologi / Pendigitalan Digunakan" description="Senaraikan sistem atau platform digital yang digunakan dalam bisnes.">
          {(formState.teknologi || [{ sistem: '', tujuan: '' }]).map((item, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 border rounded-md">
              <InputField label={`Sistem / Platform ${index + 1}`} value={item.sistem} onChange={(e) => handleDynamicListChange('teknologi', index, 'sistem', e.target.value)} placeholder="Cth: Akaun Bukku, Shopee" />
              <InputField label="Tujuan" value={item.tujuan} onChange={(e) => handleDynamicListChange('teknologi', index, 'tujuan', e.target.value)} placeholder="Cth: Rekod duit keluar masuk" />
            </div>
          ))}
          <button type="button" onClick={() => addDynamicListItem('teknologi', { sistem: '', tujuan: '' })} className="text-sm bg-gray-200 py-1 px-3 rounded-md hover:bg-gray-300">+ Tambah Sistem</button>
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
          <TextArea rows={10} value={formState.pemerhatian || ''} onChange={(e) => setFormState((p) => ({ ...p, pemerhatian: e.target.value }))} />
        </Section>

        <Section title="Inisiatif Utama" description="Berdasarkan pemerhatian, pilih Fokus Area dan Keputusan yang perlu diambil.">
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
                  <SelectField label="Keputusan" value={inisiatifItem.keputusan} onChange={(e) => handleInisiatifChange(index, 'keputusan', e.target.value)} disabled={!inisiatifItem.focusArea} required>
                    <option value="">-- Pilih Keputusan --</option>
                    {keputusanOptions.map((opt) => (
                      <option key={opt.Keputusan} value={opt.Keputusan}>{opt.Keputusan}</option>
                    ))}
                  </SelectField>
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
          <TextArea rows={6} value={formState.rumusan || ''} onChange={(e) => setFormState((p) => ({ ...p, rumusan: e.target.value }))} />
        </Section>

        <Section title="Refleksi Mentor" description="Refleksi jujur untuk penambahbaikan diri selaku mentor.">
          <TextArea label="Apa perasan sebelum dan selepas sesi?" value={formState.refleksi?.perasaan || ''} onChange={(e) => handleInputChange('refleksi', 'perasaan', e.target.value)} />
          <InputField label="Pada skala 1-10 (10-Paling cemerlang), berapa skor yang anda berikan kepada diri sendiri?" type="number" value={formState.refleksi?.skor || ''} onChange={(e) => handleInputChange('refleksi', 'skor', e.target.value)} />
          <TextArea label="Apa yang mendorong anda memberi skor di atas?" value={formState.refleksi?.alasan || ''} onChange={(e) => handleInputChange('refleksi', 'alasan', e.target.value)} />
          <TextArea label="Eliminate (Perkara yang boleh dibuang semasa sesi)" value={formState.refleksi?.eliminate || ''} onChange={(e) => handleInputChange('refleksi', 'eliminate', e.target.value)} />
          <TextArea label="Raise (Perkara yang boleh ditambahbaik selaku mentor)" value={formState.refleksi?.raise || ''} onChange={(e) => handleInputChange('refleksi', 'raise', e.target.value)} />
          <TextArea label="Reduce (Perkara yang boleh dikurangkan)" value={formState.refleksi?.reduce || ''} onChange={(e) => handleInputChange('refleksi', 'reduce', e.target.value)} />
          <TextArea label="Create (Cadangan/perkara baru yang mahu dilakukan)" value={formState.refleksi?.create || ''} onChange={(e) => handleInputChange('refleksi', 'create', e.target.value)} />
        </Section>

        <Section title="Muat Naik Gambar (Sesi 1)">
          <FileInput label="Gambar Carta GrowthWheel 360°" onChange={(e) => handleFileChange('gw', e.target.files)} required />
          <FileInput label="Satu (1) Gambar Individu Usahawan (Profil)" onChange={(e) => handleFileChange('profil', e.target.files)} required />
          <FileInput label="Dua (2) Gambar Sesi Mentoring" multiple onChange={(e) => handleFileChange('sesi', e.target.files, true)} required />
          {formState.sesi.premisDilawat && (
            <FileInput label="Dua (2) Gambar Premis Perniagaan" multiple onChange={(e) => handleFileChange('premis', e.target.files, true)} required />
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

        <Section title="Inisiatif Utama Sesi Ini">
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
                  <SelectField label="Keputusan" value={inisiatifItem.keputusan} onChange={(e) => handleInisiatifChange(index, 'keputusan', e.target.value)} disabled={!inisiatifItem.focusArea} required>
                    <option value="">-- Pilih Keputusan --</option>
                    {keputusanOptions.map((opt) => (<option key={opt.Keputusan} value={opt.Keputusan}>{opt.Keputusan}</option>))}
                  </SelectField>
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
          <TextArea rows={6} value={formState.rumusan || ''} onChange={(e) => setFormState((p) => ({ ...p, rumusan: e.target.value }))} />
        </Section>

        {!previousData.premisDilawat && (
          <Section title="Status Lawatan Premis">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-gray-800">Premis belum dilawat semasa sesi-sesi terdahulu. Sila lawat dan muat naik gambar premis dalam sesi ini.</p>
            </div>
          </Section>
        )}

        <Section title={`Muat Naik Gambar (Sesi ${currentSession})`}>
          <FileInput label="Gambar Sesi Mentoring" multiple onChange={(e) => handleFileChange('sesi', e.target.files, true)} required />
          {!previousData.premisDilawat && (
            <FileInput label="Gambar Premis Perniagaan (wajib – belum dilawat)" multiple onChange={(e) => handleFileChange('premis', e.target.files, true)} required />
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
        <header className="text-center bg-white p-6 rounded-lg shadow-sm">
          <img src="/logo1.png" alt="iTEKAD Logos" className="mx-auto h-20 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">Laporan Sesi Mentor</h1>
          <p className="text-gray-500 mt-1">Sila lengkapkan borang berdasarkan sesi semasa.</p>
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
            <div className="mt-6 pt-6 border-t text-center">
              <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-green-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                {isSubmitting ? 'Menghantar...' : 'Hantar Laporan Sesi ' + currentSession}
              </button>
              {saveStatus && <div className="mt-2 text-xs text-gray-500">{saveStatus}</div>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
